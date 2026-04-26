import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { Activity, ShieldAlert, MonitorCheck, Network as NetworkIcon } from 'lucide-react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import './App.css';

// Kết nối tới Server Node.js
const socket = io('http://localhost:3000');

// Hàm formatBytes đặt ở ngoài component để tính toán băng thông
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function App() {
  const [latestMetric, setLatestMetric] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);

  // Refs dùng để điều khiển sơ đồ Vis.js
  const networkContainerRef = useRef(null);
  const networkInstanceRef = useRef(null);
  
  const nodesRef = useRef(new DataSet([
    { 
      id: 'agent', 
      label: 'Tâm mạng\n(Sniffer)', 
      shape: 'image', 
      image: 'https://cdn-icons-png.flaticon.com/512/2885/2885412.png',
      size: 35,
      font: { color: '#ffffff' }
    }
  ]));
  const edgesRef = useRef(new DataSet([]));

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('new_metrics', (data) => setLatestMetric(data));

    if (networkContainerRef.current && !networkInstanceRef.current) {
      const data = { nodes: nodesRef.current, edges: edgesRef.current };
      const options = {
        physics: { stabilization: false, barnesHut: { springLength: 200, centralGravity: 0.3 } },
        interaction: { hover: true, zoomView: true },
      };
      networkInstanceRef.current = new Network(networkContainerRef.current, data, options);
    }

    socket.on('new_device', (device) => {
      const nodeId = device.ip;
      if (!nodesRef.current.get(nodeId)) {
        nodesRef.current.add({
          id: nodeId,
          label: `IP: ${device.ip}\nMAC: ${device.mac}`,
          shape: 'image',
          image: 'https://cdn-icons-png.flaticon.com/512/1055/1055685.png',
          size: 20,
          font: { color: '#a0aec0' }
        });
        
        edgesRef.current.add({
          id: `edge-${nodeId}`,
          from: 'agent',
          to: nodeId,
          color: { color: '#4299e1', highlight: '#63b3ed' },
          width: 2
        });
        setDeviceCount(nodesRef.current.length - 1);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_metrics');
      socket.off('new_device');
    };
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🛡️ NetSentinel Dashboard</h1>
      <p style={{ color: isConnected ? '#48bb78' : '#f56565', fontWeight: 'bold' }}>
        Trạng thái kết nối Server: {isConnected ? 'Đã kết nối (Live)' : 'Mất kết nối'}
      </p>

      {/* Row 1: Box hiển thị Metrics TCP & Bandwidth */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
        
        <div style={{ flex: 1, padding: '20px', backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '12px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e0' }}><Activity size={20}/> Traffic</h3>
          <h2 style={{ color: '#0bc5ea', fontSize: '2.5rem', margin: '10px 0' }}>
            {latestMetric ? formatBytes(latestMetric.metrics.bytesPerSec) : '--'}
          </h2>
        </div>

        <div style={{ flex: 1, padding: '20px', backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '12px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e0' }}><MonitorCheck size={20}/> TCP SYN / ACK</h3>
          <h2 style={{ color: '#cbd5e0', fontSize: '2.5rem', margin: '10px 0' }}>
            <span style={{ color: '#63b3ed'}}>{latestMetric ? latestMetric.metrics.synCount : '-'}</span> 
            <span style={{ fontSize: '1.5rem'}}> / </span> 
            <span style={{ color: '#48bb78'}}>{latestMetric ? latestMetric.metrics.ackCount : '-'}</span>
          </h2>
        </div>

        <div style={{ flex: 2, padding: '20px', backgroundColor: (latestMetric && latestMetric.alerts && latestMetric.alerts.length > 0) ? '#5c1a1a' : '#1a202c', border: '1px solid #2d3748', borderRadius: '12px', transition: 'background-color 0.5s' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e0' }}>
            <ShieldAlert size={20} color={(latestMetric && latestMetric.alerts && latestMetric.alerts.length > 0) ? '#fc8181' : '#cbd5e0'}/> 
            Trạng thái Anomaly
          </h3>
          <div style={{ margin: '10px 0', minHeight: '40px' }}>
            {(!latestMetric || !latestMetric.alerts || latestMetric.alerts.length === 0) ? (
              <h2 style={{ color: '#48bb78', margin: 0 }}>Hệ thống bình thường</h2>
            ) : (
              latestMetric.alerts.map((alert, index) => (
                <div key={index} style={{ color: '#fc8181', padding: '5px 0', fontWeight: 'bold', borderBottom: '1px solid #742a2a' }}>
                  🚨 [{alert.type}]: {alert.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Sơ đồ mạng L2 Discovery */}
      <div style={{ marginTop: '30px', backgroundColor: '#1a202c', border: '1px solid #2d3748', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e0' }}>
          <NetworkIcon size={20}/> Sơ đồ mạng nội bộ (Layer 2)
          <span style={{ fontSize: '0.9rem', backgroundColor: '#2d3748', padding: '4px 10px', borderRadius: '20px' }}>
            Phát hiện: {deviceCount} thiết bị
          </span>
        </h3>
        <div 
          ref={networkContainerRef} 
          style={{ height: '450px', backgroundColor: '#0d1117', borderRadius: '8px', border: '1px dashed #4a5568' }}
        />
      </div>

      <p style={{ marginTop: '20px', color: '#718096', textAlign: 'center' }}>
        <em>*Dữ liệu đang được đồng bộ thời gian thực từ NetSentinel Agent...</em>
      </p>
    </div>
  );
}

export default App;