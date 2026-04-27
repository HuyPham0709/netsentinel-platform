import { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { Server, Monitor, Cpu, ShieldAlert } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

export function TopologyCanvas({ devices = [] }: { devices: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef(new DataSet<any>([]));
  const edgesRef = useRef(new DataSet<any>([]));
  
  const iconCache = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const prepareIcons = () => {
      const icons = {
        server: <Server color="#22d3ee" />,
        pc: <Monitor color="#64748b" />,
        iot: <Cpu color="#64748b" />,
        attack: <ShieldAlert color="#ef4444" />
      };

      Object.entries(icons).forEach(([key, icon]) => {
        const svgString = renderToStaticMarkup(icon);
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
        iconCache.current[key] = img;
      });
    };

    prepareIcons();
    if (!containerRef.current) return;

    const options = {
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: { gravitationalConstant: -150, centralGravity: 0.01, springLength: 200, springConstant: 0.05 },
        stabilization: { iterations: 100 }
      },
      interaction: { dragNodes: true, zoomView: true, hover: true },
      nodes: { shape: 'dot', size: 1, color: 'transparent', font: { size: 0 } },
      edges: {
        width: 1,
        smooth: { enabled: false },
        color: { color: '#1e293b', opacity: 0.2 }
      }
    };

    const network = new Network(containerRef.current, { 
      nodes: nodesRef.current, 
      edges: edgesRef.current 
    }, options);

    let offset = 0;
    
    network.on("afterDrawing", (ctx) => {
      offset += 0.5; // Biến offset tăng dần tạo hiệu ứng chảy

      // ==========================================
      // 1. VẼ ANIMATED LINES
      // ==========================================
      edgesRef.current.get().forEach(edge => {
        const pos = network.getPositions([edge.from, edge.to]);
        if (!pos[edge.from] || !pos[edge.to]) return;
        const start = pos[edge.from];
        const end = pos[edge.to];

        const targetNode = nodesRef.current.get(edge.to);
        const isOffline = targetNode?.status === 'offline';

        ctx.save();
        ctx.setLineDash([4, 25]);
        
        // --- SỬA LỖI TẠI ĐÂY ---
        // Nếu offline: offset = 0 (đứng yên), nếu online: dùng offset animation
        ctx.lineDashOffset = isOffline ? 0 : -offset; 
        
        ctx.strokeStyle = isOffline 
          ? 'rgba(51, 65, 85, 0.2)' // Màu tối và mờ khi offline
          : (edge.color?.color === '#ef4444' ? '#f87171' : 'rgba(34, 211, 238, 0.6)');
        
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.restore();
      });

      // ==========================================
      // 2. VẼ NODES & INFO CARD (KHÔNG RUNG)
      // ==========================================
      const allNodes = nodesRef.current.get();
      allNodes.forEach(node => {
        const positions = network.getPositions([node.id]);
        if (!positions[node.id]) return;
        
        const { x, y } = positions[node.id];
        const isCore = node.id === 'agent';
        const isAttacked = node.underAttack;
        const isOffline = node.status === 'offline';
        const size = isCore ? 48 : 38;
        const radius = 10;

        ctx.save();
        if (isOffline) ctx.globalAlpha = 0.4;

        // --- Vẽ Node Box ---
        ctx.shadowColor = isOffline ? 'transparent' : (isAttacked ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 211, 238, 0.15)');
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.roundRect(x - size/2, y - size/2, size, size, radius);
        const grad = ctx.createLinearGradient(x - size/2, y - size/2, x + size/2, y + size/2);
        grad.addColorStop(0, 'rgba(30, 41, 59, 0.8)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isAttacked ? '#ef4444' : '#334155';
        ctx.stroke();

        // --- Vẽ Icon ---
        const iconType = isAttacked ? 'attack' : (isCore ? 'server' : (node.type || 'pc'));
        const iconImg = iconCache.current[iconType];
        if (iconImg && iconImg.complete) {
          const iconSize = size * 0.5;
          ctx.drawImage(iconImg, x - iconSize/2, y - iconSize/2, iconSize, iconSize);
        }

        // --- Vẽ Info Card ---
        const ipText = node.label || node.id;
        const statusText = isAttacked ? 'ATTACKED' : (isOffline ? 'OFFLINE' : 'ONLINE');
        const labelY = y + size/2 + 10;

        ctx.font = '10px monospace';
        const ipWidth = ctx.measureText(ipText).width;
        ctx.font = '9px monospace';
        const statusWidth = ctx.measureText(statusText).width;
        const boxWidth = Math.max(ipWidth, statusWidth) + 16; 
        const boxHeight = 32;
        
        ctx.beginPath();
        ctx.roundRect(x - boxWidth/2, labelY, boxWidth, boxHeight, 4);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#334155';
        ctx.stroke();

        ctx.font = '10px monospace';
        ctx.fillStyle = isOffline ? '#475569' : '#22d3ee';
        ctx.textAlign = 'center';
        ctx.fillText(ipText, x, labelY + 14);

        ctx.font = '9px monospace';
        ctx.fillStyle = isAttacked ? '#ef4444' : (isOffline ? '#64748b' : '#10b981'); 
        ctx.fillText(statusText, x, labelY + 25);

        ctx.restore();
      });
    });

    const animate = () => {
      network.redraw();
      requestAnimationFrame(animate);
    };
    const animId = requestAnimationFrame(animate);

    networkRef.current = network;
    return () => {
      cancelAnimationFrame(animId);
      network.destroy();
    };
  }, []);

  // Sync dữ liệu thiết bị
  useEffect(() => {
    if (!nodesRef.current.get('agent')) {
      nodesRef.current.add({ id: 'agent', label: 'SOC_CORE', type: 'server', status: 'online' });
    }

    devices.forEach(device => {
      const nodeId = device.ip;
      const isAttacked = !!device.underAttack;
      const status = device.status || 'online';

      if (!nodesRef.current.get(nodeId)) {
        nodesRef.current.add({ id: nodeId, label: device.ip, underAttack: isAttacked, type: device.type || 'pc', status });
        edgesRef.current.add({ id: `e-${nodeId}`, from: 'agent', to: nodeId, color: { color: isAttacked ? '#ef4444' : '#1e293b' } });
      } else {
        nodesRef.current.update({ id: nodeId, underAttack: isAttacked, status });
        edgesRef.current.update({ id: `e-${nodeId}`, color: { color: isAttacked ? '#ef4444' : '#1e293b' } });
      }
    });
  }, [devices]);

  return (
    <div className="relative w-full h-full bg-[#020617] rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}