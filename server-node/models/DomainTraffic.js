const mongoose = require('mongoose');

const DomainTrafficSchema = new mongoose.Schema({
    agentId: String,
    timestamp: { type: Date, default: Date.now },
    domain: String,
    source: { type: String, enum: ['DNS', 'SNI'] },
    hitCount: Number,
    totalBytes: Number
});

module.exports = mongoose.model('DomainTraffic', DomainTrafficSchema);