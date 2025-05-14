
// index.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();
const User = require('./models/User');
const Message = require('./models/Message');
const { generateToken, verifyToken } = require('./utils/jwt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Login route
app.post('/api/login', async (req, res) => {
  const username = req.body.username?.trim();
  if (!username) return res.status(400).json({ error: 'Username required' });

  let user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
  if (!user) user = await User.create({ username });

  const token = generateToken({ username: user.username });
  res.json({ token });
});

// Get chat messages
app.get('/api/messages', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const otherUser = req.query.user;
  const messages = await Message.find({
    $or: [
      { from: user.username, to: otherUser },
      { from: otherUser, to: user.username },
    ]
  }).sort({ timestamp: 1 });

  res.json(messages);
});

// WebSocket auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const user = verifyToken(token);
  if (!user) return next(new Error('Authentication error'));
  socket.user = user;
  next();
});

// WebSocket events
io.on('connection', async (socket) => {
  const { username } = socket.user;
  console.log(`${username} connected`);

  await User.findOneAndUpdate(
    { username: new RegExp(`^${username}$`, 'i') },
    { socketId: socket.id, online: true }
  );

  const users = await User.find({}, 'username online');
  io.emit('userList', users);

  socket.on('sendMessage', async ({ to, message }) => {
    const msgData = { from: username, to, message, timestamp: new Date() };
    await Message.create(msgData);

    const targetUser = await User.findOne({ username: new RegExp(`^${to}$`, 'i') });
    if (targetUser?.socketId) {
      io.to(targetUser.socketId).emit('receiveMessage', msgData);
    }

    socket.emit('receiveMessage', msgData);
  });

  socket.on('typing', async ({ to }) => {
    const targetUser = await User.findOne({ username: new RegExp(`^${to}$`, 'i') });
    if (targetUser?.socketId) {
      io.to(targetUser.socketId).emit('typing', { from: username });
    }
  });

  socket.on('disconnect', async () => {
    await User.findOneAndUpdate(
      { username: new RegExp(`^${username}$`, 'i') },
      { online: false, socketId: null }
    );
    io.emit('userOffline', username);
    console.log(`${username} disconnected`);
  });
});

mongoose.connect(MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}).catch(err => console.error('MongoDB error:', err));
