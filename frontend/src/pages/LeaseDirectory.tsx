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
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <Layers className="w-6 h-6 text-blue-400" />
              <span>Registered Concessions Directory</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Active licensed quarries and mining titles across Punjab districts.
            </p>
          </div>

          <button
            onClick={onNavigateToImport}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import New Leases</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700 w-72">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, quarry name, district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Mineral:</span>
            <select
              value={filterMineral}
              onChange={(e) => setFilterMineral(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 font-medium"
            >
              <option value="ALL">All Minerals</option>
              {minerals.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Leases Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="overflow-x-auto">
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
