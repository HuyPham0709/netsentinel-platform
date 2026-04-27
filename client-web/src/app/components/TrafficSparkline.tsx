import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export function TrafficSparkline({ label, color = '#10b981', dataKey = 'bytesPerSec' }: any) {
  const [data, setData] = useState<number[]>(Array(40).fill(0));
  const latestValue = useRef<number>(0);

  useEffect(() => {
    socket.on('new_metrics', (incomingData: any) => {
      const val = dataKey === 'synCount' ? (incomingData.metrics?.synCount || 0)
                : dataKey === 'alertCount' ? (incomingData.alerts?.length || 0)
                : (incomingData.metrics?.bytesPerSec || 0);
      latestValue.current = val;
    });
    return () => { socket.off('new_metrics'); };
  }, [dataKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => [...prev.slice(1), latestValue.current]);
    }, 1000); 
    return () => clearInterval(interval);
  }, []);

  const max = Math.max(...data, 10);
  const currentValue = data[data.length - 1] || 0;
  const isSpike = currentValue > (max * 0.8) && currentValue > 5;
  const activeColor = isSpike ? '#ff4444' : color;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 98 - (val / max) * 92; 
    return `${x},${y}`;
  }).join(' ');

  const renderDisplayValue = () => {
    if (dataKey === 'bytesPerSec') {
      return currentValue > 1048576 
        ? `${(currentValue / 1048576).toFixed(1)} MB/s` 
        : `${(currentValue / 1024).toFixed(1)} KB/s`;
    }
    return `${currentValue} ${dataKey === 'synCount' ? 'PKTs' : 'Alerts'}`;
  };

  return (
    <div className="bg-[#0a0f1e]/60 p-4 rounded-xl border border-slate-800/40 mb-3 relative">
      <div className="flex flex-col mb-4">
        <div className={`text-2xl font-mono font-bold tracking-tighter leading-none transition-colors duration-300 ${isSpike ? 'text-red-500' : 'text-emerald-400'}`}>
          {renderDisplayValue()}
        </div>
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em] mt-1 opacity-70">
          {label}
        </div>
      </div>
      
      <div className="h-14 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id={`area-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          <polyline
            points={`0,100 ${points} 100,100`}
            fill={`url(#area-${dataKey})`}
            className="transition-all duration-300"
          />

          {/* strokeWidth="1" giúp đường kẻ cực mảnh và sắc sảo */}
          <polyline
            points={points}
            fill="none"
            stroke={activeColor}
            strokeWidth="1" 
            strokeLinejoin="miter"
            strokeMiterlimit="10"
            className="transition-all duration-500 ease-in-out"
            style={{ 
              filter: isSpike ? 'drop-shadow(0 0 3px rgba(255,68,68,0.5))' : 'none',
              vectorEffect: 'non-scaling-stroke' // Giữ độ mảnh cố định không phụ thuộc vào tỉ lệ SVG
            }}
          />
        </svg>
      </div>
    </div>
  );
}