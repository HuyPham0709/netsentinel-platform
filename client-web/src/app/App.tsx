import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Activity, Shield, Wifi, Zap, Globe, Cpu, Bomb, PowerOff } from 'lucide-react';

// Components con
import { TopologyCanvas } from './components/TopologyCanvas';
import { TrafficSparkline } from './components/TrafficSparkline';
import { AlertCard } from './components/AlertCard';

const socket = io('http://localhost:3000');

export default function App() {
  const [devices, setDevices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [modalContent, setModalContent] = useState<{ type: string; data: any } | null>(null);

  useEffect(() => {
    // 1. Fetch danh sách thiết bị ban đầu
    fetch('http://localhost:3000/api/devices')
      .then(res => res.json())
      .then(data => setDevices(data))
      .catch(err => console.error("API Error:", err));

    // 2. Lắng nghe thiết bị mới từ Socket
    socket.on('new_device', (device) => {
      setDevices(prev => {
        if (prev.find(d => d.ip === device.ip)) return prev;
        return [...prev, device];
      });
    });

    // 3. Lắng nghe Metrics & Alerts mới
    socket.on('new_metrics', (data) => {
      if (data.alerts && data.alerts.length > 0) {
        setAlerts(prev => [...data.alerts, ...prev].slice(0, 20)); // Giữ 20 alerts mới nhất
      }
    });

    return () => {
      socket.off('new_device');
      socket.off('new_metrics');
    };
  }, []);

  const handleQuickView = (alert: any) => {
    setModalContent({ type: 'view', data: alert });
    setTimeout(() => setModalContent(null), 5000);
  };

  const handleBlockIp = (ip: string) => {
    setModalContent({ type: 'block', data: ip });
    setTimeout(() => setModalContent(null), 3000);
  };

  // --- HÀM SIMULATE THÊM MỚI ---
  const simulateAttack = () => {
    if (devices.length === 0) return;
    const randomIndex = Math.floor(Math.random() * devices.length);
    const newDevices = [...devices];
    newDevices[randomIndex] = {
      ...newDevices[randomIndex],
      underAttack: !newDevices[randomIndex].underAttack
    };
    setDevices(newDevices);
  };

  const simulateOffline = () => {
    if (devices.length === 0) return;
    const randomIndex = Math.floor(Math.random() * devices.length);
    const newDevices = [...devices];
    newDevices[randomIndex] = {
      ...newDevices[randomIndex],
      status: newDevices[randomIndex].status === 'offline' ? 'online' : 'offline'
    };
    setDevices(newDevices);
  };

  // Tính toán số liệu cho Network Topology
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status !== 'offline').length;

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-200 flex flex-col overflow-hidden font-mono">
      {/* HEADER: High-Tech Glassmorphism */}
      <header className="h-16 flex-shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white leading-none">
              NET<span className="text-emerald-400">SENTINEL</span>
            </h1>
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em] mt-1">
              v3.0 Secure Operations Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          {/* 2 NÚT SIMULATE MỚI */}
          <div className="flex items-center gap-2">
            <button 
              onClick={simulateAttack}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/40 rounded-md text-red-400 text-[10px] hover:bg-red-500/20 transition-colors font-bold"
            >
              <Bomb className="w-3 h-3" /> ATK_TEST
            </button>
            <button 
              onClick={simulateOffline}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-400 text-[10px] hover:bg-slate-700 transition-colors font-bold"
            >
              <PowerOff className="w-3 h-3" /> OFF_TEST
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest leading-none mb-1">Status</span>
              <span className="text-xs text-emerald-400 font-bold tracking-tight">SYSTEM ACTIVE</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-800" />
            <div className="p-2 bg-slate-900 rounded-md">
              <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Topology Visualization */}
        <section className="flex-1 relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-transparent to-transparent">
          <div className="absolute inset-0 z-0">
              <TopologyCanvas devices={devices} />
          </div>
          
          {/* NETWORK TOPOLOGY OVERLAY (7/8 devices online) */}
          <div className="absolute top-6 left-6 flex flex-col gap-3 pointer-events-none z-10">
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800/40 p-4 rounded-lg flex flex-col gap-1 shadow-2xl min-w-[200px]">
              <h3 className="text-emerald-400 text-[11px] font-bold tracking-widest uppercase">Network Topology</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{onlineDevices} / {totalDevices}</span>
                <span className="text-[10px] text-slate-500 uppercase">devices online</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-700" 
                  style={{ width: `${totalDevices > 0 ? (onlineDevices / totalDevices) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT SIDEBAR: Monitoring & Anomalies */}
        <aside className="w-[400px] flex-shrink-0 bg-slate-950/90 border-l border-slate-800/60 flex flex-col overflow-hidden">
          
          {/* Top Panel: Metrics */}
          <div className="p-5 border-b border-slate-800/60 overflow-y-auto max-h-[45%] custom-scrollbar">
            <h2 className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Zap className="w-3 h-3" /> Real-time Traffic
            </h2>
            <div className="space-y-4">
              <TrafficSparkline label="Bandwidth Load" dataKey="bytesPerSec" color="#10b981" />
              <TrafficSparkline label="Packet Flow (SYN)" dataKey="synCount" color="#3b82f6" />
              <TrafficSparkline label="Threat Intensity" dataKey="alertCount" color="#ef4444" />
            </div>
          </div>

          {/* Bottom Panel: Alerts */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-red-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Activity className="w-3 h-3" /> Anomaly Feed
              </h2>
              <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-bold">
                {alerts.length} ALERTS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3 custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="h-32 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-2">
                  <Shield className="w-6 h-6 opacity-20" />
                  <span className="text-[10px] tracking-widest">NO ANOMALIES DETECTED</span>
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <AlertCard
                    key={`${alert.id}-${i}`}
                    alert={alert}
                    onQuickView={() => handleQuickView(alert)}
                    onBlockIp={() => handleBlockIp(alert.sourceIp)}
                  />
                ))
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* SYSTEM OVERLAYS (Modals) */}
      {modalContent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className={`relative w-full max-w-sm p-6 rounded-2xl border bg-slate-900 shadow-2xl animate-in zoom-in duration-200 ${
            modalContent.type === 'block' ? 'border-red-500/50 shadow-red-500/20' : 'border-emerald-500/50 shadow-emerald-500/20'
          }`}>
             {modalContent.type === 'view' ? (
               <>
                 <h3 className="text-emerald-400 font-bold text-sm mb-4 flex items-center gap-2">
                   <Zap className="w-4 h-4" /> ANALYSIS_REPORT
                 </h3>
                 <div className="space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed">{modalContent.data.description}</p>
                    <div className="bg-black/40 p-3 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex justify-between text-[10px]"><span className="text-slate-500">SRC:</span> <span className="text-white font-mono">{modalContent.data.sourceIp}</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-slate-500">DST:</span> <span className="text-white font-mono">{modalContent.data.targetIp}</span></div>
                    </div>
                 </div>
               </>
             ) : (
               <div className="text-center py-4">
                 <Shield className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
                 <h3 className="text-white font-bold text-lg mb-1 tracking-tighter">IP_ADDRESS_REVOKED</h3>
                 <p className="text-[11px] text-slate-500 font-mono tracking-widest uppercase">Traffic from {modalContent.data} is now null-routed.</p>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}