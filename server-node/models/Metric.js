const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    agentId: String,
    metrics: {
        synCount: Number,
        ackCount: Number,
        bytesPerSec: Number, // Lưu thêm Băng thông
        dnsQueries: [String]
    },
    alerts: [{ // Lưu trữ các cảnh báo
        type: { type: String },
        message: String
    }]
}, { 
    timeseries: {
        timeField: 'timestamp',
        metaField: 'agentId',
        granularity: 'seconds'
    }
});

module.exports = mongoose.model('Metric', MetricSchema);