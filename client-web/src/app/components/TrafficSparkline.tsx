import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export function TrafficSparkline({ label, color = '#10b981', dataKey = 'bytesPerSec' }: any) {
  const [data, setData] = useState<number[]>(Array(60).fill(0));
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
  const isSpike = currentValue > (max * 0.85) && currentValue > 5;
  const activeColor = isSpike ? '#ff3333' : color;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (val / max) * 90;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="group relative bg-[#0d1224] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all">
      <div className="flex justify-between items-end mb-3">
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-2">{label}</p>
          <h3 className={`text-2xl font-mono font-bold leading-none tracking-tighter ${isSpike ? 'text-red-500' : 'text-emerald-400'}`}>
            {currentValue.toLocaleString()} <span className="text-[10px] opacity-50 ml-1">{dataKey === 'bytesPerSec' ? 'B/s' : 'UNIT'}</span>
          </h3>
        </div>
        <div className={`text-[9px] font-mono px-2 py-0.5 rounded border ${isSpike ? 'border-red-500/50 text-red-500' : 'border-emerald-500/30 text-emerald-500/50'}`}>
          {isSpike ? 'CRITICAL' : 'STABLE'}
        </div>
      </div>

      <div className="h-14 w-full relative">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <filter id="neon">
              <feGaussianBlur stdDeviation="1" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points={`0,100 ${points} 100,100`} fill={`url(#fill-${dataKey})`} />
          <polyline
            points={points}
            fill="none"
            stroke={activeColor}
            strokeWidth="0.8"
            strokeLinejoin="miter"
            style={{ filter: 'drop-shadow(0 0 2px ' + activeColor + ')' }}
            className="transition-all duration-700"
          />
        </svg>
      </div>
    </div>
  );
}