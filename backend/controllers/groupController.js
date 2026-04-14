const Group = require('../models/Group');
const Message = require('../models/Message');
const bcrypt = require('bcrypt');

exports.createGroup = async (req, res) => {
  try {
    const { name, groupKey } = req.body;
    const adminId = req.user.userId;

    if (!name || !groupKey) {
      return res.status(400).json({ message: 'Group name and secret key are required' });
    }

    const saltRounds = 10;
    const hashedKey = await bcrypt.hash(groupKey, saltRounds);

    const newGroup = new Group({
      name,
      createdBy: adminId,
      members: [adminId],
      groupKey: hashedKey
    });

    await newGroup.save();
    res.status(201).json(newGroup);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.joinGroup = async (req, res) => {
  try {
    const { name, groupKey } = req.body;
    const userId = req.user.userId;

    const group = await Group.findOne({ name });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMatch = await bcrypt.compare(groupKey, group.groupKey);
    if (!isMatch) return res.status(401).json({ message: 'Invalid group secret key' });

    const isAlreadyMember = group.members.some(m => m.toString() === userId.toString());
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    group.members.push(userId);
    await group.save();

    res.json({ message: 'Joined successfully', group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.user.userId;
    const groups = await Group.find({ members: userId }).populate('members', 'username');
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized: Only the creator can delete the group' });
    }

    await Message.deleteMany({ groupId });
    await Group.findByIdAndDelete(groupId);

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getGroupMessages = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    const isMember = group && group.members.some(m => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ message: 'Unauthorized: Access denied' });
    }

    const messages = await Message.find({ groupId })
      .populate('senderId', 'username')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markGroupMessagesAsSeen = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const { userId, username, ghostMode } = req.user;

    // Ghost Mode: Privacy first - don't record seen status
    if (ghostMode) {
      return res.json({ message: 'Ghost mode active, seen status not recorded' });
    }

    const now = new Date();
    
    // Find all unseen messages from others in this group
    const messagesToUpdate = await Message.find({
      groupId,
      senderId: { $ne: userId },
      'seen_by.user_id': { $ne: userId }
    });

    if (messagesToUpdate.length === 0) {
      return res.json({ message: 'No new messages to mark as seen' });
    }

    const messageIds = messagesToUpdate.map(m => m._id);

    // Bulk update seen_by
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $push: { seen_by: { user_id: userId, username, seen_at: now } } }
    );

    res.json({ message_ids: messageIds, viewer: { user_id: userId, username, seen_at: now } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

