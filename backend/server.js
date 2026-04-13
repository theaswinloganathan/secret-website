require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const groupRoutes = require('./routes/groupRoutes');

const Message = require('./models/Message');
const User = require('./models/User');
const cron = require('node-cron');

// Cleanup Cron Job - Runs every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const expiredMessages = await Message.find({ expiresAt: { $lte: now } });

    if (expiredMessages.length > 0) {
      console.log(`Broom Service: Cleaning up ${expiredMessages.length} expired messages...`);
      
      for (const msg of expiredMessages) {
        const roomId = [msg.senderId.toString(), msg.receiverId.toString()].sort().join('_');
        io.to(roomId).emit('message_deleted', msg._id);
        
        if (msg.imageUrl) {
          const fileName = path.basename(msg.imageUrl);
          const filePath = path.join(__dirname, 'uploads', fileName);
          const fs = require('fs');
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await Message.findByIdAndDelete(msg._id);
      }
    }
  } catch (err) {
    console.error('Expiration Cron Error:', err);
  }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Chat-Token']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.json({ status: 'Chat API is successfully running!' });
});

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', chatRoutes);
app.use('/api/groups', groupRoutes);

const connectedUsers = new Map();

io.on('connection', (socket) => {
  socket.on('register', async (userId) => {
    socket.userId = userId;
    connectedUsers.set(userId, socket.id);
    
    const user = await User.findById(userId);
    if (user) {
      socket.ghostMode = user.ghostMode;
      // Emit offline if in ghost mode, online otherwise
      io.emit('user_status', { 
        userId, 
        status: user.ghostMode ? 'offline' : 'online' 
      });
    }
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('typing', (data) => {
    // Use socket.ghostMode for performance
    if (!socket.ghostMode) {
      socket.to(data.roomId).emit('user_typing', { userId: data.userId, typing: data.typing });
    }
  });

  socket.on('screenshot_taken', async (data) => {
    const { userId, username, roomId } = data;
    // Notify EVERYONE in the room, including sender
    io.to(roomId).emit('system_notification', { 
      type: 'screenshot', 
      content: `${username} took a screenshot`,
      timestamp: new Date()
    });
  });

  socket.on('send_message', async (data) => {
    // If it's a 1-to-1 message, check delivered status
    if (data.message.receiverId) {
      const isOnline = connectedUsers.has(data.message.receiverId);
      if (isOnline && data.message.status !== 'seen') {
        data.message.status = 'delivered';
        await Message.findByIdAndUpdate(data.message._id, { status: 'delivered' });
      }
    }
    io.to(data.roomId).emit('receive_message', data.message);
  });

  socket.on('mark_as_seen', async (data) => {
    const { readerId, senderId, roomId } = data;
    await Message.updateMany(
      { senderId: senderId, receiverId: readerId, status: { $ne: 'seen' } },
      { status: 'seen' }
    );
    
    if (!socket.ghostMode) {
      io.to(roomId).emit('message_status_update', { senderId, readerId, status: 'seen' });
    }
  });

  socket.on('delete_message', (data) => {
    io.to(data.roomId).emit('message_deleted', data.messageId);
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      await User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() });
      if (!socket.ghostMode) {
        io.emit('user_status', { userId: socket.userId, status: 'offline' });
      }
    }
  });
});

// Final catch-all for unmatched API routes to avoid HTML responses
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
