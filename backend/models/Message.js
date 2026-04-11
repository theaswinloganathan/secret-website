const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String
  },
  imageUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  }
}, { timestamps: true });

MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
MessageSchema.index({ receiverId: 1, senderId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
