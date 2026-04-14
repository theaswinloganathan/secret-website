const User = require('../models/User');
const Message = require('../models/Message');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

exports.upload = multer({ storage });

exports.verifyChatPassword = async (req, res) => {
  try {
    const { targetUserId, chatPassword } = req.body;
    const requesterId = req.user.userId;

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    const isMatch = await bcrypt.compare(chatPassword, targetUser.chatPassword);
    if (!isMatch) return res.status(401).json({ message: 'Invalid chat password' });

    const payload = { requesterId, targetUserId };
    const chatToken = jwt.sign(payload, process.env.CHAT_TOKEN_SECRET, { expiresIn: '1h' });

    res.json({ chatToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const requesterId = req.user.userId;

    const messages = await Message.find({
      $or: [
        { senderId: requesterId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: requesterId }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const Group = require('../models/Group');

exports.saveMessage = async (req, res) => {
  try {
    const { receiverId, groupId, content, imageUrl, duration } = req.body;
    const senderId = req.user.userId;

    // Security check for group messages
    if (groupId) {
      const group = await Group.findById(groupId);
      const isMember = group && group.members.some(m => m.toString() === senderId.toString());
      if (!isMember) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }
    }

    let expiresAt = null;
    if (duration && !isNaN(duration)) {
      expiresAt = new Date(Date.now() + parseInt(duration) * 60 * 60 * 1000);
    }

    const newMessage = new Message({ 
      senderId, 
      receiverId: groupId ? undefined : receiverId, 
      groupId: groupId || undefined,
      content, 
      imageUrl,
      expiresAt 
    });
    await (await newMessage.save()).populate('senderId', 'username');

    res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const requesterId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Allow deletion if the user is the sender
    const isSender = message.senderId.toString() === requesterId;
    // For private chats, allow receiver to delete. For groups, receiverId is missing.
    const isReceiver = message.receiverId && message.receiverId.toString() === requesterId;

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Unauthorized: You can only delete your own messages' });
    }

    if (message.imageUrl) {
      const fileName = path.basename(message.imageUrl);
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Message.findByIdAndDelete(messageId);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getMessageSeenStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Only the message sender can call this endpoint
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ message: 'Only the sender can view full seen status' });
    }

    if (!message.groupId) {
      return res.json({ 
        type: 'private',
        sent_at: message.createdAt,
        delivered_at: message.deliveredAt,
        seen_at: message.seenAt,
        status: message.status
      });
    }

    const group = await Group.findById(message.groupId).populate('members', 'username ghostMode');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const seenUserIds = message.seen_by.map(s => s.user_id.toString());
    
    // Seen by list from the message
    const seen_by = message.seen_by;

    // Not seen yet list: group members who are not the sender and not in seen_by
    const not_seen_yet = group.members
      .filter(m => m._id.toString() !== userId && !seenUserIds.includes(m._id.toString()))
      .map(m => ({ user_id: m._id, username: m.username }));

    res.json({ seen_by, not_seen_yet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getRecentChats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find recent messages (private only for this list)
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      groupId: { $exists: false }
    })
    .sort({ createdAt: -1 })
    .limit(50); // Look at last 50 messages to find unique users

    const recentUserIds = new Set();
    const recentUsers = [];

    for (const msg of messages) {
      if (recentUsers.length >= 10) break;
      const otherId = msg.senderId.toString() === userId.toString() ? msg.receiverId : msg.senderId;
      
      if (otherId && !recentUserIds.has(otherId.toString())) {
        recentUserIds.add(otherId.toString());
        const otherUser = await User.findById(otherId).select('username _id');
        if (otherUser) {
          recentUsers.push(otherUser);
        }
      }
    }

    res.json(recentUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
