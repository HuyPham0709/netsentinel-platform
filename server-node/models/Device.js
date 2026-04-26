const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    mac: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    agentId: String, // Để biết agent nào tìm thấy thiết bị này
});

module.exports = mongoose.model('Device', DeviceSchema);