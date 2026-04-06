const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { username, loginPassword, chatPassword } = req.body;

    if (!username || !loginPassword || !chatPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const saltRounds = 12;
    const hashedLoginPassword = await bcrypt.hash(loginPassword, saltRounds);
    const hashedChatPassword = await bcrypt.hash(chatPassword, saltRounds);

    const newUser = new User({
      username,
      loginPassword: hashedLoginPassword,
      chatPassword: hashedChatPassword
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, loginPassword } = req.body;

    if (!username || !loginPassword) {
      return res.status(400).json({ message: 'Username and login password required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(loginPassword, user.loginPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = { userId: user._id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
