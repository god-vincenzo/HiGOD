const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('./src/models/User');
const Message = require('./src/models/Message');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const memoryStore = require('./src/models/memoryStore');

// Load environment variables. Fallback to .env.example if .env is missing for local dev.
dotenv.config();
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '.env.example' });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('App will continue running, but chat history will not be saved.');
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// In-memory state for online users mapping userId -> socketId
const onlineUsers = new Map();

// Socket.io Connection & Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.username} (${socket.id})`);
  
  // Add to online users
  onlineUsers.set(socket.userId, socket.id);
  io.emit('onlineUsers', Array.from(onlineUsers.keys()));

  // Join public room by default
  socket.join('public');

  // Handle joining a private room
  socket.on('joinPrivateRoom', (targetUserId) => {
    // Create a consistent room name by sorting user IDs
    const roomName = [socket.userId, targetUserId].sort().join('_');
    socket.join(roomName);
    console.log(`${socket.username} joined private room ${roomName}`);
  });

  // Handle incoming public message
  socket.on('sendMessage', async (data) => {
    try {
      const { room, message, targetUserId } = data;
      
      // Save to database
      const newMessage = new Message({
        sender: socket.userId,
        room: targetUserId ? [socket.userId, targetUserId].sort().join('_') : 'public',
        content: message
      });
      
      if (mongoose.connection.readyState === 1) {
          await newMessage.save();
      } else {
          newMessage._id = Date.now().toString();
          memoryStore.messages.push(newMessage);
      }

      const messageObj = {
        _id: newMessage._id,
        sender: { _id: socket.userId, username: socket.username },
        room: newMessage.room,
        content: message,
        createdAt: newMessage.createdAt || new Date()
      };

      if (targetUserId) {
        // Send to private room
        const roomName = [socket.userId, targetUserId].sort().join('_');
        io.to(roomName).emit('newMessage', messageObj);
      } else {
        // Send to public room
        io.to('public').emit('newMessage', messageObj);
      }

    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  // Handle typing status
  socket.on('typing', (data) => {
    const { isTyping, room, targetUserId } = data;
    const typingData = {
      username: socket.username,
      isTyping
    };
    
    if (targetUserId) {
      const roomName = [socket.userId, targetUserId].sort().join('_');
      socket.to(roomName).emit('userTyping', typingData);
    } else {
      socket.to('public').emit('userTyping', typingData);
    }
  });

  // Handle getting message history
  socket.on('getHistory', async (data, callback) => {
    const { targetUserId } = data;
    const roomName = targetUserId ? [socket.userId, targetUserId].sort().join('_') : 'public';

    if (mongoose.connection.readyState !== 1) {
        const history = memoryStore.messages
           .filter(m => m.room === roomName)
           .map(m => {
              const senderUser = memoryStore.users.find(u => u._id === m.sender?.toString()) || { _id: m.sender, username: 'Unknown' };
              return {
                 _id: m._id,
                 sender: { _id: senderUser._id, username: senderUser.username },
                 room: m.room,
                 content: m.content,
                 createdAt: m.createdAt || new Date()
              };
           });
        return callback(history.slice(-100));
    }
    
    try {
      const messages = await Message.find({ room: roomName })
        .populate('sender', 'username')
        .sort({ createdAt: 1 })
        .limit(100); // Limit to last 100 messages to prevent overload
      callback(messages);
    } catch (err) {
      console.error('Error fetching history:', err);
      callback([]);
    }
  });

  // Handle getting user list
  socket.on('getUsers', async (callback) => {
     if (mongoose.connection.readyState !== 1) {
         const memUser = memoryStore.users.find(u => u.id === socket.userId);
         const starred = memUser && memUser.starredUsers ? memUser.starredUsers : [];
         return callback(memoryStore.users.map(u => ({ 
             _id: u._id, 
             username: u.username,
             isStarred: starred.includes(u._id.toString())
         })));
     }
     try {
       const currentUser = await User.findById(socket.userId);
       const starred = currentUser && currentUser.starredUsers ? currentUser.starredUsers.map(id => id.toString()) : [];
       
       let users = await User.find({}, '_id username').lean();
       users = users.map(u => ({
           ...u,
           isStarred: starred.includes(u._id.toString())
       }));
       callback(users);
     } catch (err) {
       console.error('Error fetching users:', err);
       callback([]);
     }
  });

  // Disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username}`);
    onlineUsers.delete(socket.userId);
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
