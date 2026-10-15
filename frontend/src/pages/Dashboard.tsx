import React, { useEffect, useState } from 'react';
import { DashboardStats, Lease } from '../types';
import { fetchDashboardStats, fetchLeases, fetchAllAnalyses } from '../api/client';
import {
  ShieldAlert,
  Layers,
  Satellite,
  Trees,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  MapPin,
  ExternalLink
} from 'lucide-react';

interface DashboardProps {
  onNavigateToMonitoring: (leaseId?: string) => void;
  onNavigateToImport: () => void;
  onNavigateToCompliance: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToMonitoring,
  onNavigateToImport,
  onNavigateToCompliance
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([fetchDashboardStats(), fetchLeases(), fetchAllAnalyses()])
      .then(([statsData, leasesData, analysesData]) => {
        setStats(statsData);
        setLeases(leasesData);
        setRecentAnalyses(analysesData.slice(0, 5));
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                DGM&M Punjab
              </span>
              <span className="text-xs text-slate-400 font-mono">Surveillance Operations Room</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">
              Mining Inspection and Monitoring Dashboard
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Automated remote-sensing surveillance of mining concessions across the Potohar and Salt Range basins.
              Monitors official lease perimeters and mandatory 1,000-metre surrounding zones for unpermitted excavation and environmental impact.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onNavigateToImport}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              + Bulk Import CSV
            </button>
            <button
              onClick={() => onNavigateToMonitoring()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer flex items-center space-x-2"
            >
              <Satellite className="w-4 h-4" />
              <span>Launch Monitoring</span>
            </button>
          </div>
        </div>

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* KPI 1: Leases */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
              <span>Registered Concessions</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {stats ? stats.registered_leases : '...'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats ? `${stats.leases_analysed} under active surveillance` : ''}
            </div>
          </div>

          {/* KPI 2: Total Detected Disturbance */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
              <span>Total Detected Disturbance</span>
              <Satellite className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-bold text-white">
                {stats ? stats.total_detected_disturbance_ha.toFixed(2) : '...'}
              </span>
              <span className="text-xs text-slate-400">ha</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Across monitored Punjab quarries
            </div>
          </div>

          {/* KPI 3: Potential Encroachment Alerts */}
          <div className={`border rounded-xl p-4 shadow-sm ${
            stats && stats.encroachment_alerts_count > 0
              ? 'bg-red-950/30 border-red-500/50 text-red-200'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-semibold">Boundary Encroachments</span>
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-red-400">
                {stats ? stats.encroachment_alerts_count : '...'}
              </span>
              <span className="text-xs text-slate-400">alerts</span>
            </div>
            <div className="text-[11px] mt-1 text-red-300">
              {stats ? `${stats.total_outside_excavation_ha.toFixed(2)} ha outside boundary` : ''}
            </div>
          </div>

          {/* KPI 4: Pending Field Verification */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center text-slate-400 text-xs mb-1">
              <span>Pending Field Verification</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {stats ? stats.pending_field_verifications : '...'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Surveillance records awaiting sign-off
            </div>
          </div>
        </div>

        {/* Secondary KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400">
                <Trees className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Vegetation Cover Loss (NDVI Reduction)</div>
                <div className="text-lg font-bold text-slate-100">
                  {stats ? `${stats.vegetation_cover_loss_ha.toFixed(2)} ha` : '...'}
                </div>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">Sentinel-2 MSI B8/B4</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Stockpile & Dump Inventory Shifts</div>
                <div className="text-lg font-bold text-slate-100">
                  {stats ? `${stats.stockpile_changes_ha.toFixed(2)} ha` : '...'}
                </div>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">Surface Reflectance</span>
          </div>
        </div>

        {/* Registered Concessions & Recent Inspections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Registered Concessions Directory */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Punjab Registered Mining Leases</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {leases.length} active concessions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="p-2.5">Lease ID</th>
                    <th className="p-2.5">Quarry Name</th>
                    <th className="p-2.5">Mineral</th>
                    <th className="p-2.5">District</th>
                    <th className="p-2.5">Area (ha)</th>
                    <th className="p-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {leases.map((l) => (
                    <tr key={l.lease_id} className="hover:bg-slate-850">
                      <td className="p-2.5 font-mono text-blue-400 font-medium">{l.lease_id}</td>
                      <td className="p-2.5 font-medium text-white">{l.quarry_name}</td>
                      <td className="p-2.5">{l.mineral}</td>
                      <td className="p-2.5">{l.district}</td>
                      <td className="p-2.5 font-mono text-slate-300">{l.lease_area_ha} ha</td>
                      <td className="p-2.5">
                        <button
                          onClick={() => onNavigateToMonitoring(l.lease_id)}
                          className="flex items-center space-x-1 text-blue-400 hover:text-white font-semibold cursor-pointer"
                        >
                          <span>Analyze</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column 3: Recent Encroachment & Surveillance Alerts */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>Recent Encroachments</span>
                </h2>
                <button
                  onClick={onNavigateToCompliance}
                  className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                >
                  View All
                </button>
              </div>

              {recentAnalyses.length > 0 ? (
                <div className="space-y-3">
                  {recentAnalyses.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{a.quarry_name || a.lease_id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          a.outside_disturbance_ha > 0 ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-emerald-950 text-emerald-300'
                        }`}>
                          {a.outside_disturbance_ha > 0 ? 'Encroachment Alert' : 'Compliant'}
                        </span>
                      </div>
                      <div className="text-slate-400 flex justify-between text-[11px]">
                        <span>Total: {Number(a.total_disturbance_ha).toFixed(2)} ha</span>
                        <span>Outside: <strong className={a.outside_disturbance_ha > 0 ? 'text-red-400' : 'text-slate-300'}>{Number(a.outside_disturbance_ha).toFixed(2)} ha</strong></span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-850">
                        <span className="text-[10px] text-slate-500 font-mono">{a.actual_end_date}</span>
                        <a
                          href={`/api/reports/${a.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-400 hover:text-white text-[11px] font-medium"
                        >
                          <FileText className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  No surveillance analyses logged yet. Run an analysis from the Monitoring tab.
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={() => onNavigateToMonitoring()}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Inspect New Lease
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
