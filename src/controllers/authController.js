const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const memoryStore = require('../models/memoryStore');

// Generate JWT
const generateToken = (id, username) => {
  return jwt.sign({ id, username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    if (mongoose.connection.readyState !== 1) {
      const userExists = memoryStore.users.find(u => u.username === username);
      if (userExists) return res.status(400).json({ message: 'User already exists' });
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newId = new mongoose.Types.ObjectId().toString();
      const user = { id: newId, _id: newId, username, password: hashedPassword, starredUsers: [] };
      
      memoryStore.users.push(user);
      return res.status(201).json({
        _id: user._id,
        username: user.username,
        token: generateToken(user._id, user.username),
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      username,
      password: hashedPassword,
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        username: user.username,
        token: generateToken(user._id, user.username),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const user = memoryStore.users.find(u => u.username === username);
      if (user && (await bcrypt.compare(password, user.password))) {
        return res.json({
          _id: user._id,
          username: user.username,
          token: generateToken(user._id, user.username),
        });
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    // Check for user email
    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        username: user.username,
        token: generateToken(user._id, user.username),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  register,
  login,
};
