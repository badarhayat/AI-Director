import React, { useState, useEffect } from 'react';
import { fetchAllAnalyses } from '../api/client';
import { Trees, Droplets, Mountain, AlertCircle, FileText, ArrowRight } from 'lucide-react';

interface EnvironmentalProps {
  onNavigateToMonitoring: (leaseId: string) => void;
}

export const Environmental: React.FC<EnvironmentalProps> = ({ onNavigateToMonitoring }) => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchAllAnalyses()
      .then((data) => setAnalyses(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const totalVegLoss = analyses.reduce((sum, a) => sum + (Number(a.ndvi_loss_ha) || 0), 0);
  const totalWaterChange = analyses.reduce((sum, a) => sum + (Number(a.water_change_ha) || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Trees className="w-6 h-6 text-pink-400" />
            <span>Environmental Impact & Spectral Index Monitoring</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tracking vegetation clearance (NDVI differencing), hydrological drainage shifts (NDWI),
            and surrounding landscape degradation within the mandatory 1,000m monitoring zone.
          </p>
        </div>

        {/* Environmental Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400">
                <Trees className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Total Vegetation Loss</span>
                <span className="text-xl font-bold text-pink-400">{totalVegLoss.toFixed(2)} ha</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Areas with significant NDVI drop (ΔNDVI &lt; -0.18)</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Hydrological / Water Shifts</span>
                <span className="text-xl font-bold text-blue-400">{totalWaterChange.toFixed(2)} ha</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Potential drainage interference or pit sump water</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Mountain className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Surrounding 1 KM Zone</span>
                <span className="text-xl font-bold text-amber-400">Mandatory Buffer</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Active ecological buffer surrounding lease polygons</p>
          </div>
        </div>

        {/* Environmental Audit Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-white">Environmental Findings by Concession</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="p-2.5">Concession</th>
                  <th className="p-2.5">District</th>
                  <th className="p-2.5">Vegetation Loss (ha)</th>
                  <th className="p-2.5">Water / Drainage (ha)</th>
                  <th className="p-2.5">Haulage Dust / Roads</th>
                  <th className="p-2.5">Recommended Verification</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {analyses.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-850">
                    <td className="p-2.5">
                      <div className="font-bold text-white">{a.quarry_name || a.lease_id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{a.lease_id}</div>
                    </td>
                    <td className="p-2.5">{a.district}</td>
                    <td className="p-2.5 font-mono text-pink-400 font-bold">
                      {Number(a.ndvi_loss_ha).toFixed(2)} ha
                    </td>
                    <td className="p-2.5 font-mono text-blue-400">
                      {Number(a.water_change_ha).toFixed(2)} ha
                    </td>
                    <td className="p-2.5 font-mono text-amber-400">
                      {Number(a.haul_roads_km).toFixed(2)} km
                    </td>
                    <td className="p-2.5 text-slate-300">
                      Verify scrub clearing & slope stabilization in 1km buffer
                    </td>
                    <td className="p-2.5">
                      <button
                        onClick={() => onNavigateToMonitoring(a.lease_id)}
                        className="text-blue-400 hover:text-white font-medium flex items-center space-x-1 cursor-pointer"
                      >
                        <span>View Map</span>
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
