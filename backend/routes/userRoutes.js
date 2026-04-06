const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

router.get('/search-users', authMiddleware, userController.searchUsers);

module.exports = router;
