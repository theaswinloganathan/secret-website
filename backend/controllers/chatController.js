const User = require('../models/User');
const Message = require('../models/Message');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.verifyChatPassword = async (req, res) => {
  try {
    const { targetUserId, chatPassword } = req.body;
    const requesterId = req.user.userId;

    if (!targetUserId || !chatPassword) {
      return res.status(400).json({ message: 'Target user ID and chat password required' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const isMatch = await bcrypt.compare(chatPassword, targetUser.chatPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid chat password for this user' });
    }

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
    const { receiverId, content } = req.body;
    const senderId = req.user.userId;

    const newMessage = new Message({ senderId, receiverId, content });
    await newMessage.save();

    res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
