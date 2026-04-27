const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    agentId: String,
    metrics: {
        synCount: Number,
        ackCount: Number,
        bytesPerSec: Number,
    },
    alerts: [{ 
        title: String,       // Khớp Figma
        sourceIp: String,    // Khớp Figma
        targetIp: String,    // Khớp Figma
        description: String, // Khớp Figma (thay cho message cũ)
        type: String         // Để phân loại màu sắc (ví dụ: 'critical', 'warning')
    }]
}, { 
    timeseries: {
        timeField: 'timestamp',
        metaField: 'agentId',
        granularity: 'seconds'
    }
});
const DomainTrafficSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    agentId: String,
    domain: String,
    source: String, // 'SNI' hoặc 'DNS'
    hitCount: Number,
    totalBytes: Number
}, { 
    timeseries: {
        timeField: 'timestamp',
        metaField: 'domain', // Dùng domain làm meta để truy vấn nhóm nhanh hơn
        granularity: 'seconds'
    }
});
module.exports = mongoose.model('DomainTraffic', DomainTrafficSchema);
module.exports = mongoose.model('Metric', MetricSchema);