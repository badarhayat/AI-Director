import React, { useState, useEffect } from 'react';
import { Lease, AnalysisResult } from '../types';
import { fetchLeases, fetchLeaseDetails, runAnalysis, updateReviewStatus } from '../api/client';
import { MapViewer } from '../components/MapViewer';
import { MetricCards } from '../components/MetricCards';
import {
  Satellite,
  Calendar,
  Play,
  FileText,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Download,
  Info,
  Clock,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Sparkles,
  Eye
} from 'lucide-react';

interface MonitoringProps {
  initialLeaseId?: string;
  onNavigateToImport?: () => void;
  onNavigateToInspection?: (leaseId?: string) => void;
}

export const Monitoring: React.FC<MonitoringProps> = ({
  initialLeaseId,
  onNavigateToImport,
  onNavigateToInspection
}) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>(initialLeaseId || '');
  const [currentLease, setCurrentLease] = useState<Lease | null>(null);
  
  // Date State
  const [startDate, setStartDate] = useState<string>('2024-01-15');
  const [endDate, setEndDate] = useState<string>('2024-12-25');
  const [imagerySource, setImagerySource] = useState<string>('Copernicus Sentinel-2 L2A');

  // Production depth assumption toggle
  const [assumedDepthM, setAssumedDepthM] = useState<number | undefined>(undefined);
  const [useDepthEstimate, setUseDepthEstimate] = useState<boolean>(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inspector Review state
  const [reviewStatus, setReviewStatus] = useState<string>('PENDING_REVIEW');
  const [reviewerRemarks, setReviewerRemarks] = useState<string>('');
  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'details'>('map');

  // Load lease list on mount
  useEffect(() => {
    fetchLeases()
      .then((data) => {
        setLeases(data);
        if (data.length > 0 && !selectedLeaseId) {
          setSelectedLeaseId(data[0].lease_id);
        }
      })
      .catch((err) => {
        setErrorMsg('Failed to load leases: ' + err.message);
      });
  }, []);

  // When selectedLeaseId changes, fetch full geometry and reset analysis
  useEffect(() => {
    if (!selectedLeaseId) return;

    fetchLeaseDetails(selectedLeaseId)
      .then((data) => {
        setCurrentLease(data);
        setAnalysisResult(null); // Clear previous analysis when switching leases
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg('Failed to load lease boundary: ' + err.message);
      });
  }, [selectedLeaseId]);

  // Preset Date Range Helper
  const applyDatePreset = (preset: 'annual' | 'quarterly' | 'same_date') => {
    if (preset === 'annual') {
      setStartDate('2024-01-15');
      setEndDate('2024-12-25');
    } else if (preset === 'quarterly') {
      setStartDate('2024-01-15');
      setEndDate('2024-04-15');
    } else if (preset === 'same_date') {
      setStartDate('2024-01-15');
      setEndDate('2024-01-15');
    }
  };

  // Handle One-Click Automatic Lease Analysis
  const handleRunAnalysis = async () => {
    if (!selectedLeaseId) return;

    // Strict Date Validation
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('Validation Error: Recent observation date (T2) must be later than or equal to Baseline date (T1).');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    // Multi-stage progress indicators
    const stages = [
      'Validating official lease geometry and generating 1,000m UTM 43N buffer...',
      'Querying AWS Earth Search STAC for cloud-free Copernicus Sentinel-2 L2A acquisitions...',
      'Retrieving visual TCI and multispectral bands (Red, Green, Blue, NIR, SWIR)...',
      'Computing Normalized Difference Vegetation Index (NDVI) & surface differencing...',
      'Executing spatial difference & auditing potential boundary encroachment...',
      'Consulting SME Mineral Density tables for production estimation...',
      'Compiling two-page government-grade PDF inspection dossier with ReportLab...'
    ];

    let stageIdx = 0;
    setAnalysisStage(stages[0]);
    const stageInterval = setInterval(() => {
      stageIdx++;
      if (stageIdx < stages.length) {
        setAnalysisStage(stages[stageIdx]);
      }
    }, 450);

    try {
      const result = await runAnalysis(selectedLeaseId, startDate, endDate, {
        assumedDepthM: useDepthEstimate ? assumedDepthM : undefined
      });
      clearInterval(stageInterval);
      setAnalysisResult(result);
      setReviewStatus('PENDING_REVIEW');
      setReviewerRemarks(`Automated satellite surveillance completed for period ${startDate} to ${endDate}.`);
    } catch (err: any) {
      clearInterval(stageInterval);
      setErrorMsg(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage('');
    }
  };

  // Download Handlers
  const handleDownloadPdf = () => {
    if (!analysisResult) return;
    window.open(`/api/reports/${analysisResult.analysis_id}/download`, '_blank');
  };

  const handleDownloadKml = () => {
    if (!analysisResult) return;
    window.open(`/api/reports/${analysisResult.analysis_id}/kml`, '_blank');
  };

  const handleSaveReview = async () => {
    if (!analysisResult) return;
    setIsSavingReview(true);
    try {
      await updateReviewStatus(analysisResult.analysis_id, reviewStatus, reviewerRemarks);
      alert('Inspection review status updated successfully.');
    } catch (e: any) {
      alert('Error updating status: ' + e.message);
    } finally {
      setIsSavingReview(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-slate-950">
      {/* Top Workflow Control Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 shadow-sm z-20 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
          {/* Step 1: Lease Selection */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select Concession:
              </label>
              {onNavigateToImport && (
                <button
                  onClick={onNavigateToImport}
                  className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer sm:hidden"
                >
                  + Import CSV
                </button>
              )}
            </div>
            <select
              value={selectedLeaseId}
              onChange={(e) => setSelectedLeaseId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none w-full sm:min-w-[240px] min-h-[42px]"
            >
              {leases.map((l) => (
                <option key={l.lease_id} value={l.lease_id}>
                  {l.lease_id} - {l.quarry_name} ({l.mineral}, {l.district})
                </option>
              ))}
            </select>
            {onNavigateToImport && (
              <button
                onClick={onNavigateToImport}
                className="hidden sm:inline text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer ml-1"
              >
                + Import CSV
              </button>
            )}
          </div>

          {/* Step 2: Date Window Selection with Presets */}
          <div className="w-full lg:w-auto flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
              <div className="flex flex-col text-[11px]">
                <span className="text-slate-400 text-[10px] uppercase font-semibold px-1">T1 Baseline:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 min-h-[38px]"
                />
              </div>
              <div className="flex flex-col text-[11px]">
                <span className="text-slate-400 text-[10px] uppercase font-semibold px-1">T2 Recent:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 min-h-[38px]"
                />
              </div>
            </div>

            {/* Verification Presets */}
            <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => applyDatePreset('annual')}
                className="text-[10px] sm:text-[11px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition"
                title="1-Year observation window with unpermitted encroachment"
              >
                1-Year Period
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('quarterly')}
                className="text-[10px] sm:text-[11px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg transition"
                title="3-Month observation window with pit deepening"
              >
                Quarterly
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('same_date')}
                className="text-[10px] sm:text-[11px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 px-2.5 py-1 rounded-lg transition"
                title="Same date comparison (verifies zero-change handling)"
              >
                No-Change Check
              </button>
            </div>
          </div>

          {/* Step 3: Primary Action Button */}
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || !selectedLeaseId}
            className={`w-full lg:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition cursor-pointer min-h-[44px] ${
              isAnalyzing
                ? 'bg-blue-800 text-blue-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:shadow-blue-500/20 active:scale-[0.98]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                <span>Analyzing Lease...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>ANALYZE LEASE</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar / Analysis Status indicator */}
        {isAnalyzing && (
          <div className="mt-3 max-w-7xl mx-auto bg-blue-950/40 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center space-x-3 text-xs text-blue-300 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
              <span>{analysisStage}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 max-w-7xl mx-auto bg-red-950/40 border border-red-500/40 text-red-300 text-xs rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white font-bold text-sm">×</button>
          </div>
        )}

        {/* Mobile View Switcher Tabs (when on small screens) */}
        <div className="lg:hidden mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-center">
          <div className="grid grid-cols-2 w-full max-w-xs bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setMobileTab('map')}
              className={`py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center space-x-1.5 ${
                mobileTab === 'map'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Satellite className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
            <button
              onClick={() => setMobileTab('details')}
              className={`py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center space-x-1.5 relative ${
                mobileTab === 'details'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Dossier</span>
              {analysisResult && (
                <span className={`w-2 h-2 rounded-full ${
                  analysisResult.metrics.outside_disturbance_ha > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                } ml-1`} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Map + Results Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left / Center Map Workspace */}
        <div className={`flex-1 relative h-full ${mobileTab === 'details' ? 'hidden lg:block' : 'block'}`}>
          <MapViewer
            lease={currentLease}
            analysisResult={analysisResult}
            onDownloadPdf={handleDownloadPdf}
            onDownloadKml={handleDownloadKml}
          />

          {/* Mobile Floating Results Summary Pill on Map */}
          {analysisResult && mobileTab === 'map' && (
            <div className="lg:hidden absolute bottom-3 inset-x-3 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center space-x-2">
                {analysisResult.metrics.outside_disturbance_ha > 0 ? (
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                ) : (
                  <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                )}
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">
                    {analysisResult.metrics.outside_disturbance_ha > 0
                      ? `⚠️ ${analysisResult.metrics.outside_disturbance_ha.toFixed(2)} ha Outside Boundary`
                      : `✅ Compliant (${analysisResult.metrics.inside_disturbance_ha.toFixed(2)} ha)`}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Tap to review complete analytical findings
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileTab('details')}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-2 rounded-xl shadow transition flex-shrink-0 min-h-[38px]"
              >
                <span>Dossier</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Analytical Details & Regulatory Findings Panel */}
        <div className={`w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-y-auto ${
          mobileTab === 'map' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Inspection Details</h2>
              {currentLease && (
                <span className="text-[11px] bg-slate-800 text-blue-400 font-mono px-2 py-0.5 rounded border border-slate-700">
                  {currentLease.lease_id}
                </span>
              )}
            </div>

            {currentLease && (
              <div className="mt-2 text-xs space-y-1">
                <div className="text-slate-100 font-semibold">{currentLease.quarry_name}</div>
                <div className="text-slate-400 flex items-center justify-between">
                  <span>Mineral: <strong className="text-slate-300">{currentLease.mineral}</strong></span>
                  <span>District: <strong className="text-slate-300">{currentLease.district}</strong></span>
                </div>
                <div className="text-slate-400 flex items-center justify-between">
                  <span>Concession: <strong className="text-slate-300">{currentLease.lease_area_ha} ha</strong></span>
                  <span>UTM 43N: <strong className="text-slate-300">{currentLease.calculated_area_ha} ha</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Analysis Results View */}
          {analysisResult ? (
            <div className="p-4 space-y-4">
              {/* Critical Encroachment Banner if applicable */}
              {analysisResult.metrics.outside_disturbance_ha > 0 ? (
                <div className="bg-red-950/40 border border-red-500/60 rounded-xl p-3 text-red-200 shadow-sm animate-pulse">
                  <div className="flex items-center space-x-2 text-red-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>POTENTIAL BOUNDARY ENCROACHMENT</span>
                  </div>
                  <p className="text-[11px] text-red-300 mt-1 leading-relaxed">
                    Detected <strong>{analysisResult.metrics.outside_disturbance_ha.toFixed(2)} ha</strong> ({analysisResult.metrics.outside_disturbance_sqm.toLocaleString()} m²) of surface excavation beyond the official lease perimeter in the mandatory 1 km buffer zone.
                  </p>
                </div>
              ) : analysisResult.metrics.total_disturbance_ha === 0 ? (
                <div className="bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-slate-200 shadow-sm">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs">
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                    <span>ZERO CHANGE DETECTED</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    No new surface disturbance detected between the selected observation dates.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-emerald-200 shadow-sm">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>BOUNDARY COMPLIANT</span>
                  </div>
                  <p className="text-[11px] text-emerald-300 mt-1">
                    All detected quarry disturbance ({analysisResult.metrics.inside_disturbance_ha.toFixed(2)} ha) is confined within the official legal lease boundary.
                  </p>
                </div>
              )}

              {/* Analytical Summary Metrics */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Quantitative Metrics
                </h3>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-slate-400">Total New Disturbance:</span>
                    <span className="font-bold text-white">
                      {analysisResult.metrics.total_disturbance_ha.toFixed(2)} ha
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-slate-400">Inside Authorized Perimeter:</span>
                    <span className="text-emerald-400 font-medium">
                      {analysisResult.metrics.inside_disturbance_ha.toFixed(2)} ha
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-slate-400">Potential Outside Encroachment:</span>
                    <span className={analysisResult.metrics.outside_disturbance_ha > 0 ? "text-red-400 font-bold" : "text-slate-400"}>
                      {analysisResult.metrics.outside_disturbance_ha.toFixed(2)} ha
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-slate-400">Change % of Concession:</span>
                    <span className="font-mono text-blue-400">
                      {analysisResult.metrics.change_pct_of_lease}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-slate-400">Vegetation Loss (NDVI):</span>
                    <span className="text-pink-400 font-medium">
                      {analysisResult.metrics.vegetation_loss_ha.toFixed(2)} ha
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">Stockpile / Dump Changes:</span>
                    <span className="text-amber-400 font-medium">
                      {analysisResult.metrics.stockpile_change_ha} ha
                    </span>
                  </div>
                </div>
              </div>

              {/* Satellite Overpass Metadata & Source Verification */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Satellite Acquisition</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    analysisResult.satellite_metadata.is_demonstration_source ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {analysisResult.satellite_metadata.is_demonstration_source ? 'DEMO DATA' : 'LIVE SENTINEL-2'}
                  </span>
                </h3>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sensor:</span>
                    <span className="font-medium text-slate-200">{analysisResult.satellite_metadata.imagery_source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">T1 Acquisition:</span>
                    <span className="font-mono text-slate-200">{analysisResult.satellite_metadata.actual_start_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">T2 Acquisition:</span>
                    <span className="font-mono text-slate-200">{analysisResult.satellite_metadata.actual_end_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Spatial Resolution:</span>
                    <span className="font-mono text-slate-200">{analysisResult.satellite_metadata.resolution_m} m</span>
                  </div>
                  <div className="pt-1 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800">
                    {analysisResult.satellite_metadata.notes}
                  </div>
                </div>
              </div>

              {/* Geotechnical Mineral Production Estimation */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Production & Mass Estimation
                </h3>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bulk Density:</span>
                    <span className="font-mono text-slate-200">
                      {analysisResult.production_estimates.in_situ_bulk_density_t_per_m3} t/m³ (SME Handbook)
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                    <Info className="w-3.5 h-3.5 text-blue-400 inline mr-1 -mt-0.5" />
                    {analysisResult.production_estimates.volume_note}
                  </div>
                </div>
              </div>

              {/* Inspector Review & Regulatory Status Block */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Field Verification & Review
                </h3>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Inspection Status:</label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="PENDING_REVIEW">Pending Review</option>
                      <option value="REQUIRES_FIELD_INSPECTION">Requires Field Inspection</option>
                      <option value="VERIFIED">Verified / Action Initiated</option>
                      <option value="NOT_SUBSTANTIATED">Not Substantiated</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Inspector Notes:</label>
                    <textarea
                      value={reviewerRemarks}
                      onChange={(e) => setReviewerRemarks(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-2 text-xs"
                      placeholder="Enter verification notes..."
                    />
                  </div>
                  <button
                    onClick={handleSaveReview}
                    disabled={isSavingReview}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 rounded-lg font-medium transition cursor-pointer"
                  >
                    {isSavingReview ? 'Saving...' : 'Update Review Record'}
                  </button>
                </div>
              </div>

              {/* Download & Inspection Workspace Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => onNavigateToInspection?.(selectedLeaseId)}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-blue-200" />
                  <span>Open in Visual Inspection Workspace</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-xl border border-slate-700 transition cursor-pointer text-xs"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Download PDF Inspection Report</span>
                </button>

                <button
                  onClick={handleDownloadKml}
                  className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium py-2 px-4 rounded-xl border border-slate-700 transition cursor-pointer text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export Google Earth KML</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs my-auto space-y-3">
              <Satellite className="w-10 h-10 text-slate-600 mx-auto" />
              <div>
                <p className="font-semibold text-slate-300">Ready for Automated Surveillance</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Click <strong>ANALYZE LEASE</strong> above to run Sentinel-2 change detection across the concession and surrounding 1 km buffer zone.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
