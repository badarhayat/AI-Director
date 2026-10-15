import React from 'react';
import { AnalysisMetrics } from '../types';
import { AlertTriangle, CheckCircle, Trees, Layers, TrendingUp, Navigation, Mountain } from 'lucide-react';

interface MetricCardsProps {
  metrics: AnalysisMetrics;
  leaseAreaHa: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics, leaseAreaHa }) => {
  const hasEncroachment = metrics.outside_disturbance_ha > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Card 1: Total Disturbance */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Total Detected Disturbance</span>
          <Layers className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-100">{metrics.total_disturbance_ha.toFixed(2)}</span>
          <span className="text-xs text-slate-400 font-medium">ha</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>{metrics.total_disturbance_sqm.toLocaleString()} m²</span>
          <span className="text-blue-400 font-mono font-medium">{metrics.change_pct_of_lease}% of lease</span>
        </div>
      </div>

      {/* Card 2: Potential Boundary Encroachment (CRITICAL) */}
      <div className={`rounded-xl p-3.5 shadow-sm border ${
        hasEncroachment
          ? 'bg-red-950/30 border-red-500/50 text-red-200'
          : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
      }`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold tracking-wide">
            {hasEncroachment ? 'Outside Encroachment' : 'Boundary Compliance'}
          </span>
          {hasEncroachment ? (
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className={`text-2xl font-extrabold ${hasEncroachment ? 'text-red-400' : 'text-emerald-400'}`}>
            {metrics.outside_disturbance_ha.toFixed(2)}
          </span>
          <span className="text-xs font-medium">ha</span>
        </div>
        <div className="text-[11px] mt-1 flex items-center justify-between">
          <span>{metrics.outside_disturbance_sqm.toLocaleString()} m²</span>
          {hasEncroachment ? (
            <span className="bg-red-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
              ALERT: {metrics.encroachment_pct}% outside
            </span>
          ) : (
            <span className="text-emerald-400 font-medium">100% Inside Concession</span>
          )}
        </div>
      </div>

      {/* Card 3: Inside-Lease Authorized Work */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Inside Concession Disturbance</span>
          <Mountain className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-slate-100">{metrics.inside_disturbance_ha.toFixed(2)}</span>
          <span className="text-xs text-slate-400 font-medium">ha</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>{metrics.inside_disturbance_sqm.toLocaleString()} m²</span>
          <span className="text-slate-300">Authorized pit footprint</span>
        </div>
      </div>

      {/* Card 4: Environmental & Stockpile Impacts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
          <span>Vegetation Loss (NDVI)</span>
          <Trees className="w-4 h-4 text-pink-400" />
        </div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl font-bold text-pink-400">{metrics.vegetation_loss_ha.toFixed(2)}</span>
          <span className="text-xs text-slate-400 font-medium">ha</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>Stockpiles: {metrics.stockpile_change_ha} ha</span>
          <span className="text-amber-400">Roads: {metrics.haul_roads_km} km</span>
        </div>
      </div>
    </div>
  );
};
