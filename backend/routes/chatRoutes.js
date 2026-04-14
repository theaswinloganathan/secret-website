const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const chatAccessMiddleware = (req, res, next) => {
  // Bypass for group interactions or checking seen status (which handles its own auth)
  if (req.body.groupId || req.params.groupId || req.query.groupId || req.path.includes('/seen')) {
    return next();
  }

  const chatToken = req.headers['x-chat-token'];
  if (!chatToken) return res.status(403).json({ message: 'Chat token required for 1-to-1 sessions' });
  try {
    const decoded = jwt.verify(chatToken, process.env.CHAT_TOKEN_SECRET);
    if (decoded.requesterId !== req.user.userId) return res.status(403).json({ message: 'Unauthorized session' });
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired chat token' });
  }
};

router.post('/verify-chat-password', authMiddleware, chatController.verifyChatPassword);
router.get('/recent', authMiddleware, chatController.getRecentChats);
router.get('/messages/:userId', authMiddleware, chatAccessMiddleware, chatController.getMessages);
router.post('/messages', authMiddleware, chatAccessMiddleware, chatController.saveMessage);
router.delete('/messages/:messageId', authMiddleware, chatAccessMiddleware, chatController.deleteMessage);
router.get('/messages/:messageId/seen', authMiddleware, chatAccessMiddleware, chatController.getMessageSeenStatus);
router.post('/upload', authMiddleware, chatAccessMiddleware, chatController.upload.single('image'), chatController.uploadImage);

module.exports = router;
