import { AlertTriangle, Eye, Shield, Zap, Target } from "lucide-react";

interface Alert {
  id: string;
  type: "critical" | "warning";
  title: string;
  sourceIp: string;
  targetIp: string;
  timestamp: string;
  description: string;
}

interface AlertCardProps {
  alert: Alert;
  onQuickView: (id: string) => void;
  onBlockIp: (ip: string) => void;
}

export function AlertCard({ alert, onQuickView, onBlockIp }: AlertCardProps) {
  const isCritical = alert.type === "critical";
  const themeColor = isCritical ? "red" : "orange";

  return (
    <div
      className={`relative bg-[#0a0f1e]/80 backdrop-blur-md p-4 rounded-xl border transition-all duration-300 hover:translate-x-1 group ${
        isCritical
          ? "border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
          : "border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
      }`}
    >
      {/* Hiệu ứng tia sáng ở góc card */}
      <div className={`absolute top-0 right-0 w-16 h-16 opacity-10 pointer-events-none overflow-hidden rounded-tr-xl`}>
        <div className={`absolute top-[-20px] right-[-20px] w-full h-full rotate-45 bg-${themeColor}-500`} />
      </div>

      <div className="flex items-start gap-4">
        {/* Icon trực quan lớn hơn */}
        <div className="relative">
          <div
            className={`p-3 rounded-xl ${
              isCritical ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
            } border border-${themeColor}-500/20`}
          >
            <AlertTriangle className={`w-5 h-5 ${isCritical ? "animate-pulse" : ""}`} />
          </div>
          {/* Badge nhỏ chỉ trạng thái */}
          <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0a0f1e] ${isCritical ? "bg-red-500" : "bg-orange-500"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-mono font-black text-xs uppercase tracking-wider ${isCritical ? "text-red-400" : "text-orange-400"}`}>
              {alert.title}
            </h4>
            <span className="text-[9px] font-mono text-slate-500 opacity-60">
              [{alert.timestamp}]
            </span>
          </div>

          <p className="text-[11px] text-slate-400 font-mono leading-relaxed mb-3 line-clamp-2">
            <span className="text-slate-600 mr-1">DETAIL:</span> {alert.description}
          </p>

          {/* Visual Network Path - Trực quan hóa luồng Traffic */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-slate-800/50 mb-4">
            <div className="flex flex-col">
              <span className="text-[8px] text-slate-500 uppercase font-bold">Source</span>
              <span className="text-[10px] text-emerald-400 font-mono">{alert.sourceIp}</span>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-emerald-500/50 via-slate-700 to-cyan-500/50 relative">
                <Zap className="w-2 h-2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-50" />
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[8px] text-slate-500 uppercase font-bold">Target</span>
              <span className="text-[10px] text-cyan-400 font-mono">{alert.targetIp}</span>
            </div>
          </div>

          {/* Action Buttons chuyên nghiệp */}
          <div className="flex gap-2">
            <button
              onClick={() => onQuickView(alert.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg text-[10px] text-slate-300 font-bold uppercase tracking-tighter transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              Analyze
            </button>
            <button
              onClick={() => onBlockIp(alert.sourceIp)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter transition-all ${
                isCritical
                  ? "bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400"
                  : "bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/40 text-orange-400"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Null Route
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}