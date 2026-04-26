const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    agentId: String,
    metrics: {
        synCount: Number,
        ackCount: Number,
        dnsQueries: [String] // Danh sách các domain vừa truy cập
    }
}, { 
    // Tối ưu cho MongoDB 5.0+ (Time Series Collection)
    timeseries: {
        timeField: 'timestamp',
        metaField: 'agentId',
        granularity: 'seconds'
    }
});

module.exports = mongoose.model('Metric', MetricSchema);