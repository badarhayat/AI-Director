import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Download, Database, Layers, ArrowRight } from 'lucide-react';
import { Lease } from '../types';

interface LeaseImportProps {
  onImportComplete?: () => void;
  onNavigateToMonitoring?: (leaseId: string) => void;
}

export const LeaseImport: React.FC<LeaseImportProps> = ({
  onImportComplete,
  onNavigateToMonitoring
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [templateFormat, setTemplateFormat] = useState<'FORMAT_B' | 'FORMAT_A'>('FORMAT_B');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle preview parse
  const handleParseAndPreview = async (commitToDb: boolean = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    setImportStatus(null);

    const formData = new FormData();
    if (inputMode === 'upload' && file) {
      formData.append('file', file);
    } else if (inputMode === 'paste' && csvText.trim()) {
      formData.append('csv_text', csvText);
    } else {
      setErrorMsg('Please select a CSV file or paste coordinate text.');
      setIsLoading(false);
      return;
    }

    formData.append('commit', commitToDb ? 'true' : 'false');

    try {
      const res = await fetch('/api/leases/import-csv', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse CSV');
      }

      setPreviewData(data);
      if (commitToDb) {
        setImportStatus(`Successfully saved ${data.saved_count} lease(s) to database!`);
        if (onImportComplete) onImportComplete();
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error processing CSV');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = (format: string) => {
    window.open(`/api/leases/template/download?format=${format}`, '_blank');
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-20 md:pb-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 sm:pb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
              <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              <span>Bulk Lease Coordinate Import</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Upload mining lease boundaries via CSV. Polygons are projected into UTM Zone 43N to compute true surface areas and automatic 1 km monitoring zones.
            </p>
          </div>

          {/* Download CSV Templates */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 px-1 font-mono">Template:</span>
            <button
              onClick={() => downloadTemplate('FORMAT_B')}
              className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-blue-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer min-h-[36px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Format B (Vertices)</span>
            </button>
            <button
              onClick={() => downloadTemplate('FORMAT_A')}
              className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer min-h-[36px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Format A (WKT)</span>
            </button>
          </div>
        </div>

        {/* Input Toggle: File Upload vs Paste Text */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-4 border-b border-slate-800 pb-3">
            <button
              onClick={() => setInputMode('upload')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                inputMode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Upload CSV File
            </button>
            <button
              onClick={() => setInputMode('paste')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                inputMode === 'paste' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Paste CSV / Text
            </button>
          </div>

          {inputMode === 'upload' ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-8 text-center transition bg-slate-950/50">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="csvFileInput"
              />
              <label htmlFor="csvFileInput" className="cursor-pointer flex flex-col items-center space-y-2">
                <UploadCloud className="w-10 h-10 text-slate-400" />
                <span className="text-sm font-medium text-slate-200">
                  {file ? file.name : 'Click to select lease coordinate CSV file, or drag and drop'}
                </span>
                <span className="text-xs text-slate-500">Supports standard CSV exports from DGM&M GIS databases</span>
              </label>
            </div>
          ) : (
            <div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="lease_id,quarry_name,mineral,district,company_name,vertex_order,latitude,longitude&#10;DEMO-001,Demo Quarry,Limestone,Chakwal,Demo Co,1,32.9000,72.7000&#10;..."
                rows={6}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Automatic validation checks coordinate bounds, polygon closure, and self-intersections.
            </span>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleParseAndPreview(false)}
                disabled={isLoading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                {isLoading ? 'Processing...' : 'Validate & Preview'}
              </button>
              <button
                onClick={() => handleParseAndPreview(true)}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-md transition cursor-pointer"
              >
                {isLoading ? 'Saving...' : 'Validate & Save to Database'}
              </button>
            </div>
          </div>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-4 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {importStatus && (
          <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-4 text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{importStatus}</span>
            </div>
          </div>
        )}

        {/* Preview Results Table */}
        {previewData && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span>Parsed Lease Validation Summary</span>
                <span className="bg-slate-800 text-slate-300 text-xs font-normal px-2 py-0.5 rounded border border-slate-700">
                  {previewData.format_detected}
                </span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {previewData.total_parsed} leases parsed
              </span>
            </div>

            {/* Warnings / Auto-close notices */}
            {previewData.warnings && previewData.warnings.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-[11px] text-amber-300 space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Validation Notices:</span>
                </div>
                {previewData.warnings.map((w: string, i: number) => (
                  <div key={i} className="pl-4">• {w}</div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="p-2.5">Lease ID</th>
                    <th className="p-2.5">Quarry Name</th>
                    <th className="p-2.5">Mineral</th>
                    <th className="p-2.5">District</th>
                    <th className="p-2.5">Vertices</th>
                    <th className="p-2.5">Claimed Area</th>
                    <th className="p-2.5">Calculated (UTM 43N)</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {previewData.leases.map((l: any) => (
                    <tr key={l.lease_id} className="hover:bg-slate-850">
                      <td className="p-2.5 font-mono text-blue-400 font-medium">{l.lease_id}</td>
                      <td className="p-2.5 font-medium text-white">{l.quarry_name}</td>
                      <td className="p-2.5">{l.mineral}</td>
                      <td className="p-2.5">{l.district}</td>
                      <td className="p-2.5 font-mono">{l.vertex_count}</td>
                      <td className="p-2.5 font-mono">{l.lease_area_ha ? `${l.lease_area_ha} ha` : 'N/A'}</td>
                      <td className="p-2.5 font-mono text-emerald-400 font-bold">{l.calculated_area_ha} ha</td>
                      <td className="p-2.5">
                        {l.is_duplicate ? (
                          <span className="bg-amber-950 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-800 font-medium">
                            Already in DB
                          </span>
                        ) : (
                          <span className="bg-emerald-950 text-emerald-300 text-[10px] px-2 py-0.5 rounded border border-emerald-800 font-medium">
                            Validated
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {onNavigateToMonitoring && (
                          <button
                            onClick={() => onNavigateToMonitoring(l.lease_id)}
                            className="flex items-center space-x-1 text-blue-400 hover:text-white font-medium cursor-pointer"
                          >
                            <span>Monitor</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
