import { AlertTriangle, Eye, Shield, Terminal } from "lucide-react";

export function AlertCard({ alert, onQuickView, onBlockIp }: any) {
  const isCritical = alert.type === "critical";
  const accentColor = isCritical ? "text-red-500" : "text-amber-500";
  const bgColor = isCritical ? "bg-red-500/5" : "bg-amber-500/5";
  const borderColor = isCritical ? "border-red-500/20" : "border-amber-500/20";

  return (
    <div className={`relative overflow-hidden bg-[#0d1224] border ${borderColor} rounded-xl p-4 transition-all hover:bg-[#12182d]`}>
      {/* Decorative Corner */}
      <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 ${borderColor} opacity-30`} />

      <div className="flex gap-4">
        {/* ICON BOX - Đẹp như Figma */}
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 rounded-lg ${bgColor} border ${borderColor} flex items-center justify-center relative group`}>
            <div className={`absolute inset-0 ${bgColor} blur-md opacity-0 group-hover:opacity-100 transition-opacity`} />
            <AlertTriangle className={`w-6 h-6 ${accentColor} relative z-10`} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-black uppercase tracking-widest ${accentColor}`}>
              {isCritical ? '!!! Danger Zone' : '>> Warning'}
            </span>
            <span className="text-[9px] font-mono text-slate-600">ID: {alert.id.slice(0, 6)}</span>
          </div>

          <h4 className="text-sm font-bold text-slate-200 mb-2 leading-tight tracking-tight">
            {alert.title}
          </h4>

          {/* Data Badge Group */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="bg-black/40 px-2 py-1 rounded border border-white/5 flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-slate-500" />
              <code className="text-[10px] text-emerald-400">{alert.sourceIp}</code>
            </div>
            <div className="bg-black/40 px-2 py-1 rounded border border-white/5 text-[10px] text-slate-400">
              {alert.timestamp}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button 
              onClick={() => onQuickView(alert.id)}
              className="flex-1 py-2 bg-slate-800/40 hover:bg-slate-700/60 rounded-md text-[10px] font-bold text-slate-300 border border-white/5 transition-all uppercase tracking-tighter"
            >
              Analyze
            </button>
            <button 
              onClick={() => onBlockIp(alert.sourceIp)}
              className={`px-4 py-2 rounded-md text-[10px] font-bold border transition-all uppercase tracking-tighter ${
                isCritical ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              Block
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}