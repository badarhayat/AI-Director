import React, { useState, useEffect } from 'react';
import { fetchAllAnalyses, updateReviewStatus } from '../api/client';
import { ShieldAlert, AlertTriangle, CheckCircle, FileText, ExternalLink, MapPin } from 'lucide-react';

interface ComplianceProps {
  onNavigateToMonitoring: (leaseId: string) => void;
}

export const Compliance: React.FC<ComplianceProps> = ({ onNavigateToMonitoring }) => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    fetchAllAnalyses()
      .then((data) => setAnalyses(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (analysisId: string, newStatus: string) => {
    setUpdatingId(analysisId);
    try {
      await updateReviewStatus(analysisId, newStatus, 'Status updated via Compliance Console');
      loadData();
    } catch (e: any) {
      alert('Failed to update status: ' + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const encroachments = analyses.filter((a) => a.outside_disturbance_ha > 0);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-20 md:pb-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 sm:pb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
              <span>Boundary Compliance & Surveillance</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authoritative spatial auditing of detected quarry disturbance intersecting the mandatory 1,000-metre outer monitoring buffer.
            </p>
          </div>
          <div className="bg-red-950/40 border border-red-500/50 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs text-red-300 font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse flex-shrink-0" />
            <span>{encroachments.length} Active Alerts</span>
          </div>
        </div>

        {/* Regulatory Guidance Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 text-xs text-slate-300 space-y-1.5 leading-relaxed">
          <div className="font-semibold text-slate-100 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <span>SOP for DGM&M Field Officers:</span>
          </div>
          <p className="text-slate-400">
            Detected surface disturbance within the 1 km surrounding monitoring zone requires ground-truthing survey using DGPS / Total Station against the licensed coordinate pillars.
          </p>
        </div>

        {/* Table / Cards of Encroachment Records */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-white">Surveillance Audit Log</h2>
            <span className="text-[11px] text-slate-400 font-mono">{analyses.length} total records</span>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {analyses.map((a) => {
              const hasEncroach = a.outside_disturbance_ha > 0;
              return (
                <div key={a.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {a.id}
                      </span>
                      <h3 className="font-bold text-sm text-white mt-1">{a.quarry_name || a.lease_id}</h3>
                      <p className="text-[11px] text-slate-400">{a.district} • {a.mineral}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      hasEncroach ? 'bg-red-950/90 text-red-300 border border-red-800' : 'bg-emerald-950/80 text-emerald-300'
                    }`}>
                      {hasEncroach ? 'Encroachment' : 'Compliant'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2 rounded-lg border border-slate-850">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Inside Pit:</span>
                      <span className="font-bold text-emerald-400">{Number(a.inside_disturbance_ha).toFixed(2)} ha</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Outside Lease:</span>
                      <span className={`font-bold ${hasEncroach ? 'text-red-400' : 'text-slate-400'}`}>
                        {Number(a.outside_disturbance_ha).toFixed(2)} ha
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Inspection Status:
                    </label>
                    <select
                      value={a.review_status}
                      disabled={updatingId === a.id}
                      onChange={(e) => handleStatusChange(a.id, e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded-xl border font-medium bg-slate-900 text-slate-200 border-slate-700 min-h-[40px]"
                    >
                      <option value="PENDING_REVIEW">Pending Review</option>
                      <option value="REQUIRES_FIELD_INSPECTION">Requires Field Inspection</option>
                      <option value="VERIFIED">Verified / Action Initiated</option>
                      <option value="NOT_SUBSTANTIATED">Not Substantiated</option>
                    </select>
                  </div>

                  <button
                    onClick={() => onNavigateToMonitoring(a.lease_id)}
                    className="w-full py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white font-semibold rounded-xl text-xs border border-blue-500/30 flex items-center justify-center space-x-1.5 transition min-h-[40px]"
                  >
                    <span>View Spatial Audit on Map</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="p-2.5">Analysis ID</th>
                  <th className="p-2.5">Lease ID & Quarry</th>
                  <th className="p-2.5">Observation Period</th>
                  <th className="p-2.5">Inside Pit</th>
                  <th className="p-2.5">Outside Encroachment</th>
                  <th className="p-2.5">Encroachment %</th>
                  <th className="p-2.5">Review Status</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {analyses.map((a) => {
                  const hasEncroach = a.outside_disturbance_ha > 0;
                  return (
                    <tr key={a.id} className="hover:bg-slate-850">
                      <td className="p-2.5 font-mono text-slate-400 text-[11px]">{a.id}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-white">{a.quarry_name || a.lease_id}</div>
                        <div className="text-[10px] text-slate-400">{a.district} • {a.mineral}</div>
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">
                        {a.actual_start_date} to {a.actual_end_date}
                      </td>
                      <td className="p-2.5 font-mono text-emerald-400">
                        {Number(a.inside_disturbance_ha).toFixed(2)} ha
                      </td>
                      <td className="p-2.5 font-mono">
                        {hasEncroach ? (
                          <span className="text-red-400 font-extrabold bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
                            {Number(a.outside_disturbance_ha).toFixed(2)} ha
                          </span>
                        ) : (
                          <span className="text-slate-500">0.00 ha</span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono">
                        {hasEncroach ? (
                          <span className="text-red-400 font-bold">{a.encroachment_pct}%</span>
                        ) : (
                          <span className="text-emerald-500">0%</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <select
                          value={a.review_status}
                          disabled={updatingId === a.id}
                          onChange={(e) => handleStatusChange(a.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border font-medium ${
                            a.review_status === 'VERIFIED'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : a.review_status === 'REQUIRES_FIELD_INSPECTION'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          <option value="PENDING_REVIEW">Pending Review</option>
                          <option value="REQUIRES_FIELD_INSPECTION">Requires Field Inspection</option>
                          <option value="VERIFIED">Verified</option>
                          <option value="NOT_SUBSTANTIATED">Not Substantiated</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onNavigateToMonitoring(a.lease_id)}
                            className="text-blue-400 hover:text-white font-medium cursor-pointer"
                            title="Re-open in satellite map viewer"
                          >
                            Map
                          </button>
                          <a
                            href={`/api/reports/${a.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white"
                            title="Download PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
