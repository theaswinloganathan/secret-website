const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const chatPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.user.userId}-${req.body.targetUserId}`,
  message: { message: 'Too many failed attempts. Locked out from this user for 15 minutes.' }
});

const chatAccessMiddleware = (req, res, next) => {
  const chatToken = req.header('X-Chat-Token');
  if (!chatToken) return res.status(403).json({ message: 'Chat access token required' });
  
  try {
    const decoded = jwt.verify(chatToken, process.env.CHAT_TOKEN_SECRET);
    const targetUserId = req.params.userId || req.body.receiverId;
    
    if (decoded.requesterId !== req.user.userId || decoded.targetUserId !== targetUserId) {
       return res.status(403).json({ message: 'Invalid chat access token for this pairing' });
    }
    next();
  } catch (err) {
    res.status(403).json({ message: 'Chat token is expired or invalid' });
  }
};

router.post('/verify-chat-password', authMiddleware, chatPasswordLimiter, chatController.verifyChatPassword);
router.get('/messages/:userId', authMiddleware, chatAccessMiddleware, chatController.getMessages);
router.post('/messages', authMiddleware, chatAccessMiddleware, chatController.saveMessage);

module.exports = router;
