const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, groupController.createGroup);
router.post('/join', authMiddleware, groupController.joinGroup);
router.get('/', authMiddleware, groupController.getUserGroups);
router.delete('/:id', authMiddleware, groupController.deleteGroup);
router.get('/:groupId/messages', authMiddleware, groupController.getGroupMessages);

module.exports = router;
