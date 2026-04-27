import { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

interface TopologyProps {
  devices: any[];
}

export function TopologyCanvas({ devices }: TopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef(new DataSet<any>([]));
  const edgesRef = useRef(new DataSet<any>([]));

  useEffect(() => {
    if (!containerRef.current) return;

    // Khởi tạo node gốc nếu chưa có
    if (!nodesRef.current.get('agent')) {
      nodesRef.current.add({
        id: 'agent',
        label: 'SOC ENGINE',
        shape: 'circularImage',
        image: 'https://cdn-icons-png.flaticon.com/512/2885/2885412.png',
        size: 30,
        font: { color: '#22d3ee', size: 14, face: 'Monaco' },
        color: { border: '#06b6d4', background: '#083344' }
      });
    }

    const options = {
      physics: {
        enabled: true,
        barnesHut: { 
          gravitationalConstant: -2000, 
          centralGravity: 0.3, 
          springLength: 150 
        },
        stabilization: { iterations: 150 }
      },
      interaction: { 
        hover: true, 
        zoomView: true, 
        dragNodes: true 
      },
      nodes: { 
        borderWidth: 2, 
        shadow: { enabled: true, color: 'rgba(6,182,212,0.2)' } 
      },
      edges: { 
        smooth: { type: 'continuous' }, 
        color: { color: '#1e293b' } 
      }
    };

    networkRef.current = new Network(
      containerRef.current, 
      { nodes: nodesRef.current, edges: edgesRef.current }, 
      options
    );

    return () => networkRef.current?.destroy();
  }, []);

  // Cập nhật node mới khi devices thay đổi
  useEffect(() => {
    devices.forEach(device => {
      if (!nodesRef.current.get(device.ip)) {
        nodesRef.current.add({
          id: device.ip,
          label: device.ip,
          shape: 'circularImage',
          image: 'https://cdn-icons-png.flaticon.com/512/1055/1055685.png',
          size: 20,
          font: { color: '#94a3b8', size: 11 },
          color: { border: '#334155', background: '#0f172a' }
        });
        edgesRef.current.add({
          from: 'agent',
          to: device.ip,
          dashes: true
        });
      }
    });
  }, [devices]);

  return <div ref={containerRef} className="w-full h-full bg-[#020617]" />;
}