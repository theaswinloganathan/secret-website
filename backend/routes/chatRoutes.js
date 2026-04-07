const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const chatAccessMiddleware = (req, res, next) => {
  const chatToken = req.headers['x-chat-token'];
  if (!chatToken) return res.status(403).json({ message: 'Chat token required' });
  try {
    const decoded = jwt.verify(chatToken, process.env.CHAT_TOKEN_SECRET);
    if (decoded.requesterId !== req.user.userId) return res.status(403).json({ message: 'Unauthorized' });
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired chat token' });
  }
};

router.post('/verify-chat-password', authMiddleware, chatController.verifyChatPassword);
router.get('/messages/:userId', authMiddleware, chatAccessMiddleware, chatController.getMessages);
router.post('/messages', authMiddleware, chatAccessMiddleware, chatController.saveMessage);
router.delete('/messages/:messageId', authMiddleware, chatAccessMiddleware, chatController.deleteMessage);
router.post('/upload', authMiddleware, chatAccessMiddleware, chatController.upload.single('image'), chatController.uploadImage);

module.exports = router;
