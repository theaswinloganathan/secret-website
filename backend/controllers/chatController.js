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

exports.saveMessage = async (req, res) => {
  try {
    const { receiverId, content, imageUrl, duration } = req.body;
    const senderId = req.user.userId;

    let expiresAt = null;
    if (duration && !isNaN(duration)) {
      expiresAt = new Date(Date.now() + parseInt(duration) * 60 * 60 * 1000);
    }

    const newMessage = new Message({ 
      senderId, 
      receiverId, 
      content, 
      imageUrl,
      expiresAt 
    });
    await newMessage.save();

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

    // Allow deletion if the user is either the sender OR the receiver
    if (message.senderId.toString() !== requesterId && message.receiverId.toString() !== requesterId) {
      return res.status(403).json({ message: 'Unauthorized: You can only delete your own conversations' });
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
