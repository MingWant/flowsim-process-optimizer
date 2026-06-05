import React from 'react';

export const MetroStatPill: React.FC<{ label: string; value: string | number; tone?: string }> = ({ label, value, tone = 'text-slate-100' }) => (
  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/72 px-1.5 py-1 text-center shadow-inner">
    <div className="truncate text-[8px] font-bold uppercase leading-none tracking-[0.14em] text-slate-500">{label}</div>
    <div className={`mt-1 truncate text-[11px] font-mono font-black leading-none ${tone}`} title={String(value)}>{value}</div>
  </div>
);
