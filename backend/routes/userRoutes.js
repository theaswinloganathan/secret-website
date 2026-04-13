const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

router.get('/search-users', authMiddleware, userController.searchUsers);
router.patch('/ghost-mode', authMiddleware, userController.toggleGhostMode);

module.exports = router;
