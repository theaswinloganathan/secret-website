const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  loginPassword: {
    type: String,
    required: true,
  },
  chatPassword: {
    type: String,
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
