const User = require('../models/User');
const mongoose = require('mongoose');
const memoryStore = require('../models/memoryStore');

const starUser = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  if (mongoose.connection.readyState !== 1) {
    const memUser = memoryStore.users.find(u => u.id === currentUserId);
    if (!memUser) return res.status(404).json({ message: 'User not found' });
    if (!memUser.starredUsers) memUser.starredUsers = [];
    if (!memUser.starredUsers.includes(userId)) {
      memUser.starredUsers.push(userId);
    }
    return res.json({ success: true, starredUsers: memUser.starredUsers });
  }

  try {
    const user = await User.findById(currentUserId);
    if (!user.starredUsers.includes(userId)) {
      user.starredUsers.push(userId);
      await user.save();
    }
    res.json({ success: true, starredUsers: user.starredUsers });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const unstarUser = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  if (mongoose.connection.readyState !== 1) {
    const memUser = memoryStore.users.find(u => u.id === currentUserId);
    if (!memUser) return res.status(404).json({ message: 'User not found' });
    if (!memUser.starredUsers) memUser.starredUsers = [];
    memUser.starredUsers = memUser.starredUsers.filter(id => id !== userId);
    return res.json({ success: true, starredUsers: memUser.starredUsers });
  }

  try {
    const user = await User.findById(currentUserId);
    user.starredUsers = user.starredUsers.filter(id => id.toString() !== userId);
    await user.save();
    res.json({ success: true, starredUsers: user.starredUsers });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { starUser, unstarUser };
