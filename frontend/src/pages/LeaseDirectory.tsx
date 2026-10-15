import React, { useState, useEffect } from 'react';
import { Lease } from '../types';
import { fetchLeases } from '../api/client';
import { Layers, Search, MapPin, ArrowRight, UploadCloud } from 'lucide-react';

interface LeaseDirectoryProps {
  onNavigateToMonitoring: (leaseId: string) => void;
  onNavigateToImport: () => void;
}

export const LeaseDirectory: React.FC<LeaseDirectoryProps> = ({
  onNavigateToMonitoring,
  onNavigateToImport
}) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [search, setSearch] = useState<string>('');
  const [filterMineral, setFilterMineral] = useState<string>('ALL');

  useEffect(() => {
    fetchLeases()
      .then((data) => setLeases(data))
      .catch((e) => console.error(e));
  }, []);

  const minerals = Array.from(new Set(leases.map((l) => l.mineral)));

  const filtered = leases.filter((l) => {
    const matchesSearch =
      l.lease_id.toLowerCase().includes(search.toLowerCase()) ||
      l.quarry_name.toLowerCase().includes(search.toLowerCase()) ||
      l.district.toLowerCase().includes(search.toLowerCase());
    const matchesMineral = filterMineral === 'ALL' || l.mineral.toLowerCase() === filterMineral.toLowerCase();
    return matchesSearch && matchesMineral;
  });

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-20 md:pb-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-3 sm:pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              <span>Registered Concessions</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Active licensed quarries and mining titles across Punjab districts.
            </p>
          </div>

          <button
            onClick={onNavigateToImport}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow transition cursor-pointer min-h-[40px]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Leases</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-700 flex-1 min-h-[42px]">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search ID, quarry, district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <span className="text-xs text-slate-400">Mineral:</span>
            <select
              value={filterMineral}
              onChange={(e) => setFilterMineral(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 font-medium flex-1 sm:flex-initial min-h-[42px]"
            >
              <option value="ALL">All Minerals</option>
              {minerals.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Leases Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-white">Registered Concession Records</h2>
            <span className="text-[11px] text-slate-400 font-mono">{filtered.length} matches</span>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filtered.map((l) => (
              <div key={l.lease_id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-blue-400 font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-900/60">
                      {l.lease_id}
                    </span>
                    <h3 className="font-bold text-sm text-white mt-1">{l.quarry_name}</h3>
                    <p className="text-[11px] text-slate-400">{l.district} • <span className="text-slate-300 font-medium">{l.mineral}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-400 block">{l.calculated_area_ha} ha</span>
                    <span className="text-[10px] text-slate-500 font-mono">UTM 43N</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                  <span className="text-[10px] text-slate-500 block">Lessee / Operator:</span>
                  <span className="text-slate-200 truncate block">{l.company_name || 'Government of Punjab Mineral Concession'}</span>
                </div>

                <button
                  onClick={() => onNavigateToMonitoring(l.lease_id)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow min-h-[42px] transition active:scale-[0.98]"
                >
                  <span>Launch Satellite Surveillance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="p-3">Lease ID</th>
                  <th className="p-3">Quarry Name</th>
                  <th className="p-3">Mineral</th>
                  <th className="p-3">District</th>
                  <th className="p-3">Company / Lessee</th>
                  <th className="p-3">Claimed Area</th>
                  <th className="p-3">Calculated (UTM 43N)</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((l) => (
                  <tr key={l.lease_id} className="hover:bg-slate-850">
                    <td className="p-3 font-mono text-blue-400 font-bold">{l.lease_id}</td>
                    <td className="p-3 font-semibold text-white">{l.quarry_name}</td>
                    <td className="p-3">
                      <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                        {l.mineral}
                      </span>
                    </td>
                    <td className="p-3">{l.district}</td>
                    <td className="p-3 text-slate-400">{l.company_name || 'N/A'}</td>
                    <td className="p-3 font-mono text-slate-300">{l.lease_area_ha} ha</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{l.calculated_area_ha} ha</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigateToMonitoring(l.lease_id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-medium inline-flex items-center space-x-1 cursor-pointer transition"
                      >
                        <span>Surveillance</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
