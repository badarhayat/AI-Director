import React, { useState, useEffect } from 'react';
import { fetchAllAnalyses } from '../api/client';
import { FileText, Download, ExternalLink, Satellite, ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react';

interface ReportsHistoryProps {
  onNavigateToMonitoring: (leaseId: string) => void;
}

export const ReportsHistory: React.FC<ReportsHistoryProps> = ({ onNavigateToMonitoring }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchAllAnalyses()
      .then((data) => setReports(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <FileText className="w-6 h-6 text-blue-400" />
              <span>DGM&M Inspection Reports Repository</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Historical archive of satellite surveillance inspection reports generated for the Government of the Punjab.
              Download official signed PDF dossiers and Google Earth KML boundary archives.
            </p>
          </div>
          <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-mono">
            {reports.length} Generated Reports
          </span>
        </div>

        {/* Reports Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="p-2.5">Report ID</th>
                  <th className="p-2.5">Quarry / Concession</th>
                  <th className="p-2.5">District</th>
                  <th className="p-2.5">Observation Window</th>
                  <th className="p-2.5">Disturbance</th>
                  <th className="p-2.5">Outside Encroachment</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reports.map((r) => {
                  const hasEncroach = r.outside_disturbance_ha > 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-850">
                      <td className="p-2.5 font-mono text-slate-400 text-[11px] font-medium">
                        {r.id}
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-white">{r.quarry_name || r.lease_id}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{r.lease_id}</div>
                      </td>
                      <td className="p-2.5">{r.district}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-400">
                        {r.actual_start_date} → {r.actual_end_date}
                      </td>
                      <td className="p-2.5 font-mono text-white">
                        {Number(r.total_disturbance_ha).toFixed(2)} ha
                      </td>
                      <td className="p-2.5 font-mono">
                        {hasEncroach ? (
                          <span className="text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-800 text-[11px]">
                            {Number(r.outside_disturbance_ha).toFixed(2)} ha
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-[11px]">Compliant</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          r.review_status === 'VERIFIED'
                            ? 'bg-emerald-950 text-emerald-300'
                            : r.review_status === 'REQUIRES_FIELD_INSPECTION'
                            ? 'bg-amber-950 text-amber-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {r.review_status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onNavigateToMonitoring(r.lease_id)}
                            className="bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white px-2 py-1 rounded text-xs transition cursor-pointer"
                            title="Open in Map"
                          >
                            Map
                          </button>
                          <a
                            href={`/api/reports/${r.id}/kml`}
                            download
                            className="bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white px-2 py-1 rounded text-xs transition flex items-center space-x-1"
                            title="Export Google Earth KML"
                          >
                            <Download className="w-3 h-3" />
                            <span>KML</span>
                          </a>
                          <a
                            href={`/api/reports/${r.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-1 rounded text-xs transition flex items-center space-x-1"
                            title="Download PDF Inspection Report"
                          >
                            <FileText className="w-3 h-3" />
                            <span>PDF</span>
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
