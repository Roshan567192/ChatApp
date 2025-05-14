const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  socketId: { type: String, default: null },
  online: { type: Boolean, default: false },
});

module.exports = mongoose.model('User', UserSchema);
