const User = require('../models/User');

exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.json([]);

    const sanitizedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const users = await User.find({
      username: { $regex: sanitizedQuery, $options: 'i' },
      _id: { $ne: req.user.userId }
    }).select('username _id');

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleGhostMode = async (req, res) => {
  try {
    const { ghostMode } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { ghostMode },
      { new: true }
    ).select('-loginPassword -chatPassword');
    
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
