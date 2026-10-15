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
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              <span>Boundary Compliance & Encroachment Surveillance</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authoritative spatial auditing of detected quarry disturbance intersecting the mandatory 1,000-metre outer monitoring buffer.
              Distinguishes authorized concessions from potential boundary encroachment requiring on-site field verification.
            </p>
          </div>
          <div className="bg-red-950/40 border border-red-500/50 px-3.5 py-2 rounded-xl text-xs text-red-300 font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
            <span>{encroachments.length} Active Encroachment Alerts</span>
          </div>
        </div>

        {/* Regulatory Guidance Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1.5 leading-relaxed">
          <div className="font-semibold text-slate-100 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Standard Operating Procedure (SOP) for DGM&M Field Officers:</span>
          </div>
          <p className="text-slate-400">
            Detected surface disturbance within the 1 km surrounding monitoring zone does not constitute a legal conviction.
            The inspector must conduct a ground-truthing survey using DGPS / Total Station against the licensed coordinate pillars.
          </p>
        </div>

        {/* Table of Encroachment Records */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Surveillance Audit Log</h2>
            <span className="text-xs text-slate-400 font-mono">{analyses.length} total surveillance jobs</span>
          </div>

          <div className="overflow-x-auto">
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
