import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Activity, Shield, Wifi } from 'lucide-react';

// Import các component con của bạn
import { TopologyCanvas } from './components/TopologyCanvas';
import { TrafficSparkline } from './components/TrafficSparkline';
import { AlertCard } from './components/AlertCard';

const socket = io('http://localhost:3000');

export default function App() {
  const [devices, setDevices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [modalContent, setModalContent] = useState<{ type: string; data: any } | null>(null);

  useEffect(() => {
    // 1. Lấy danh sách thiết bị ban đầu
    fetch('http://localhost:3000/api/devices')
      .then(res => res.json())
      .then(data => setDevices(data))
      .catch(err => console.error("Lỗi fetch devices:", err));

    // 2. Lắng nghe thiết bị mới
    socket.on('new_device', (device) => {
      setDevices(prev => {
        if (prev.find(d => d.ip === device.ip)) return prev;
        return [...prev, device];
      });
    });

    // 3. Lắng nghe alerts mới
    socket.on('new_metrics', (data) => {
      if (data.alerts && data.alerts.length > 0) {
        setAlerts(prev => [...data.alerts, ...prev].slice(0, 10));
      }
    });

    return () => {
      socket.off('new_device');
      socket.off('new_metrics');
    };
  }, []);

  const handleQuickView = (alert: any) => {
    setModalContent({ type: 'view', data: alert });
    setTimeout(() => setModalContent(null), 3000);
  };

  const handleBlockIp = (ip: string) => {
    setModalContent({ type: 'block', data: ip });
    setTimeout(() => setModalContent(null), 2000);
  };

  return (
    <div className="size-full bg-black flex flex-col overflow-hidden font-sans text-slate-200">
      {/* HEADER */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-emerald-400 font-mono font-bold">NetSentinel</h1>
              <p className="text-[11px] text-slate-500 font-mono uppercase tracking-tighter">Security Operations Center</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] text-slate-400 font-mono">Status: <span className="text-emerald-400">ACTIVE</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-[11px] text-slate-400 font-mono uppercase">Live Monitoring</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* TRÁI: SƠ ĐỒ (Topology) */}
        <div className="flex-[7] relative border-r border-slate-800/50 bg-[#020617]">
          <TopologyCanvas devices={devices} />
        </div>

        {/* PHẢI: DASHBOARD (3 bảng Traffic + Anomaly) */}
        <div className="flex-[3] bg-slate-950 p-6 overflow-y-auto space-y-8 border-l border-slate-800">
          
          {/* KHỐI 1: TRAFFIC ANALYSIS (Chứa 3 bảng) */}
          <section className="space-y-4">
            <h2 className="text-emerald-400 font-mono text-sm flex items-center gap-2 uppercase tracking-widest">
              <Activity className="w-4 h-4" />
              Traffic Analysis
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <TrafficSparkline label="Total Network Traffic" color="#10b981" dataKey="bytesPerSec" />
              <TrafficSparkline label="Incoming Requests" color="#3b82f6" dataKey="synCount" />
              <TrafficSparkline label="DDoS Traffic Detected" color="#ef4444" dataKey="alertCount" />
            </div>
          </section>

          {/* KHỐI 2: ANOMALY FEED */}
          <section className="space-y-4">
            <h2 className="text-emerald-400 font-mono text-sm flex items-center gap-2 uppercase tracking-widest">
              <Shield className="w-4 h-4" />
              Anomaly Feed
            </h2>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-800 rounded-lg">
                  <p className="text-[10px] text-slate-600 font-mono uppercase">Scanning for threats...</p>
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <AlertCard
                    key={i}
                    alert={alert}
                    onQuickView={() => handleQuickView(alert)}
                    onBlockIp={() => handleBlockIp(alert.sourceIp)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* MODAL NOTIFICATION (Dùng cho Quick View & Block) */}
      {modalContent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-lg p-6 max-w-md shadow-2xl animate-in zoom-in duration-200">
            {modalContent.type === 'view' ? (
              <div className="font-mono">
                <h3 className="text-emerald-400 mb-3 border-b border-slate-800 pb-2">Alert Detail</h3>
                <p className="text-xs text-slate-300">{modalContent.data.description}</p>
                <div className="mt-4 text-[10px] text-slate-500">Source: {modalContent.data.sourceIp}</div>
              </div>
            ) : (
              <div className="text-center font-mono">
                <h3 className="text-red-400 mb-2 font-bold">SYSTEM ACTION</h3>
                <p className="text-xs text-slate-300">IP ADDRESS <span className="text-white bg-red-600 px-1">{modalContent.data}</span> HAS BEEN NULL-ROUTED.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}