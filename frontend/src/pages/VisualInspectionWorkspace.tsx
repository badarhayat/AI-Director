import React, { useState, useEffect } from 'react';
import {
  fetchLeases,
  fetchLeaseDetails,
  runAnalysis,
  verifyFeature,
  fetchAnalysisFeatures,
  importKmlLayer,
  importGeoreferencedImage,
  fetchImportedLayers
} from '../api/client';
import { Lease, AnalysisResult, CandidateFeature, ImportedLayer } from '../types';
import { DualMapViewer } from '../components/DualMapViewer';
import {
  Satellite,
  Calendar,
  Layers,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Download,
  UploadCloud,
  FileText,
  Search,
  Filter,
  Info,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Eye,
  Sliders,
  MapPin
} from 'lucide-react';

interface VisualInspectionWorkspaceProps {
  initialLeaseId?: string;
  onNavigateToMonitoring?: (leaseId?: string) => void;
}

export const VisualInspectionWorkspace: React.FC<VisualInspectionWorkspaceProps> = ({
  initialLeaseId,
  onNavigateToMonitoring
}) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>(initialLeaseId || '');
  const [currentLease, setCurrentLease] = useState<Lease | null>(null);

  // Date controls
  const [startDate, setStartDate] = useState<string>('2024-01-15');
  const [endDate, setEndDate] = useState<string>('2024-04-15');

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Candidate Features & Inspector Verification
  const [featuresList, setFeaturesList] = useState<CandidateFeature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<CandidateFeature | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');
  const [inspectorNotesInput, setInspectorNotesInput] = useState<string>('');
  const [savingVerification, setSavingVerification] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'audit'>('map');

  // Imported Layers
  const [importedLayers, setImportedLayers] = useState<ImportedLayer[]>([]);
  const [importedGeojsonList, setImportedGeojsonList] = useState<any[]>([]);

  // Modals
  const [showKmlModal, setShowKmlModal] = useState<boolean>(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [showGeModal, setShowGeModal] = useState<boolean>(false);

  // Form states for modals
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imgDate, setImgDate] = useState<string>('2023-05-15');
  const [imgSource, setImgSource] = useState<string>('Google Earth Pro Historical Archive (Maxar 0.5m)');
  const [northLat, setNorthLat] = useState<string>('32.780');
  const [southLat, setSouthLat] = useState<string>('32.750');
  const [eastLon, setEastLon] = useState<string>('72.840');
  const [westLon, setWestLon] = useState<string>('72.800');
  const [imgNotes, setImgNotes] = useState<string>('Historical bench baseline prior to current concession lease');
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);

  // Load Leases on Mount
  useEffect(() => {
    fetchLeases()
      .then((data) => {
        setLeases(data);
        if (!selectedLeaseId && data.length > 0) {
          setSelectedLeaseId(data[0].lease_id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // When selectedLeaseId changes, load details
  useEffect(() => {
    if (!selectedLeaseId) return;
    fetchLeaseDetails(selectedLeaseId)
      .then((l) => {
        setCurrentLease(l);
        // Pre-fill bounding coordinates for image import dialog
        if (l.bounds) {
          setSouthLat(l.bounds[0][0].toFixed(4));
          setWestLon(l.bounds[0][1].toFixed(4));
          setNorthLat(l.bounds[1][0].toFixed(4));
          setEastLon(l.bounds[1][1].toFixed(4));
        }
        // Load any imported layers for this lease
        fetchImportedLayers(selectedLeaseId)
          .then((layers) => {
            setImportedLayers(layers);
            const geojsons = layers
              .filter((ly) => ly.layer_type === 'KML' && ly.geojson)
              .map((ly) => ly.geojson);
            setImportedGeojsonList(geojsons);
          })
          .catch(() => {});
      })
      .catch((err) => console.error(err));
  }, [selectedLeaseId]);

  // Run Dual-Date Analysis
  const handleRunAnalysis = async () => {
    if (!selectedLeaseId) return;
    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('End date must be later than or equal to Start date.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSelectedFeature(null);

    try {
      const res = await runAnalysis(selectedLeaseId, startDate, endDate);
      setAnalysisResult(res);

      // Extract all candidate features
      const allFeats = res.features?.all_features || [
        ...(res.features?.inside || []),
        ...(res.features?.outside || [])
      ];
      setFeaturesList(allFeats);
      if (allFeats.length > 0) {
        setSelectedFeature(allFeats[0]);
        setInspectorNotesInput(allFeats[0].properties.inspector_notes || '');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Analysis failed. Please check network connectivity.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-run analysis when lease loads if no result yet
  useEffect(() => {
    if (selectedLeaseId && !analysisResult && !loading) {
      handleRunAnalysis();
    }
  }, [selectedLeaseId]);

  // Handle Feature Selection
  const handleFeatureClick = (feat: CandidateFeature | null) => {
    setSelectedFeature(feat);
    if (feat) {
      setInspectorNotesInput(feat.properties.inspector_notes || '');
    }
  };

  // Handle Inspector Decision Verification
  const handleVerifyFeature = async (status: 'CONFIRMED' | 'REJECTED' | 'FIELD_VERIFY') => {
    if (!analysisResult || !selectedFeature) return;

    setSavingVerification(true);
    try {
      const featId = selectedFeature.properties.id || String(selectedFeature.properties.db_id);
      await verifyFeature(
        analysisResult.analysis_id,
        featId,
        status,
        inspectorNotesInput
      );

      // Update local state
      const updatedList = featuresList.map((f) => {
        if (f.properties.id === selectedFeature.properties.id) {
          return {
            ...f,
            properties: {
              ...f.properties,
              verification_status: status,
              inspector_notes: inspectorNotesInput,
              verified_at: new Date().toISOString()
            }
          };
        }
        return f;
      });

      setFeaturesList(updatedList);
      setSelectedFeature((prev) =>
        prev
          ? {
              ...prev,
              properties: {
                ...prev.properties,
                verification_status: status,
                inspector_notes: inspectorNotesInput,
                verified_at: new Date().toISOString()
              }
            }
          : null
      );
    } catch (err: any) {
      alert(`Verification update failed: ${err.message}`);
    } finally {
      setSavingVerification(false);
    }
  };

  // Handle KML Import
  const handleKmlUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kmlFile) return;

    setModalSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', kmlFile);
      if (selectedLeaseId) formData.append('lease_id', selectedLeaseId);

      const res = await importKmlLayer(formData);
      if (res.geojson) {
        setImportedGeojsonList((prev) => [...prev, res.geojson]);
      }
      setShowKmlModal(false);
      setKmlFile(null);
      alert(`KML layer "${res.layer_name}" successfully imported (${res.feature_count} features).`);
    } catch (err: any) {
      alert(`KML import error: ${err.message}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Georeferenced Image Import
  const handleImageUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;

    setModalSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('lease_id', selectedLeaseId);
      formData.append('acquisition_date', imgDate);
      formData.append('imagery_source', imgSource);
      formData.append('north_lat', northLat);
      formData.append('south_lat', southLat);
      formData.append('east_lon', eastLon);
      formData.append('west_lon', westLon);
      formData.append('notes', imgNotes);

      const res = await importGeoreferencedImage(formData);
      setShowImageModal(false);
      setImageFile(null);
      alert(`Georeferenced imagery successfully imported for period ${res.acquisition_date}.`);
    } catch (err: any) {
      alert(`Image import error: ${err.message}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Verification Breakdown Counters
  const countConfirmed = featuresList.filter((f) => f.properties.verification_status === 'CONFIRMED').length;
  const countFieldVerify = featuresList.filter((f) => f.properties.verification_status === 'FIELD_VERIFY').length;
  const countRejected = featuresList.filter((f) => f.properties.verification_status === 'REJECTED').length;
  const countCandidate = featuresList.filter(
    (f) => !f.properties.verification_status || f.properties.verification_status === 'CANDIDATE'
  ).length;

  // Filtered features list for drawer
  const filteredFeatures = featuresList.filter((f) => {
    if (activeCategoryFilter === 'ALL') return true;
    if (activeCategoryFilter === 'ENCROACHMENT') return f.properties.category === 'POTENTIAL_ENCROACHMENT';
    if (activeCategoryFilter === 'INSIDE') return f.properties.category === 'INSIDE_EXCAVATION';
    if (activeCategoryFilter === 'BENCH') return f.properties.category === 'CANDIDATE_BENCH';
    if (activeCategoryFilter === 'STOCKPILE') return f.properties.category === 'STOCKPILE';
    if (activeCategoryFilter === 'ROAD') return f.properties.category === 'HAUL_ROAD';
    if (activeCategoryFilter === 'VEG') return f.properties.category === 'VEGETATION_LOSS';
    return true;
  });

  // Centroid for Google Earth Web URL
  const centroidLat = currentLease?.centroid ? currentLease.centroid[0] : 32.765;
  const centroidLng = currentLease?.centroid ? currentLease.centroid[1] : 72.825;
  const googleEarthWebUrl = `https://earth.google.com/web/@${centroidLat.toFixed(6)},${centroidLng.toFixed(6)},750a,1500d,35y,0h,45t,0r`;

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header & Surveillance Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-tight text-white uppercase">
                Visual Inspection Workspace
              </h1>
              <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-mono font-semibold border border-blue-500/30">
                DUAL-DATE SYNCHRONIZED
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Government of Punjab | Directorate General of Mines & Minerals
            </p>
          </div>
        </div>

        {/* Lease Selection & Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lease Select */}
          <select
            value={selectedLeaseId}
            onChange={(e) => setSelectedLeaseId(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            {leases.map((l) => (
              <option key={l.lease_id} value={l.lease_id}>
                {l.lease_id} - {l.quarry_name} ({l.district})
              </option>
            ))}
          </select>

          {/* Date Range Controls */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">T1:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none"
            />
            <span className="text-slate-600">→</span>
            <span className="text-slate-400 text-[11px]">T2:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="hidden xl:flex space-x-1">
            <button
              onClick={() => { setStartDate('2024-01-15'); setEndDate('2024-12-25'); }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium"
            >
              Annual (1 Y)
            </button>
            <button
              onClick={() => { setStartDate('2024-01-15'); setEndDate('2024-04-15'); }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium"
            >
              Quarterly (3 M)
            </button>
            <button
              onClick={() => { setStartDate('2024-01-15'); setEndDate('2024-01-15'); }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded font-medium text-emerald-400"
            >
              Same-Date
            </button>
          </div>

          {/* Run Analysis Button */}
          <button
            onClick={handleRunAnalysis}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>Analyze & Inspect</span>
              </>
            )}
          </button>
        </div>

        {/* Global Inspection Utilities (Google Earth, KML, PDF) */}
        <div className="flex items-center space-x-2">
          {/* Google Earth Web button */}
          <a
            href={googleEarthWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open 3D location in Google Earth Web"
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center space-x-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Google Earth Web</span>
          </a>

          {/* Google Earth Pro KML Download */}
          {analysisResult && (
            <a
              href={`/api/reports/${analysisResult.analysis_id}/kml`}
              download
              title="Launch directly in Google Earth Pro desktop"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Google Earth Pro</span>
            </a>
          )}

          {/* Import KML Layer */}
          <button
            onClick={() => setShowKmlModal(true)}
            title="Import inspection GPS tracks or handheld boundaries"
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden lg:inline">Import KML</span>
          </button>

          {/* Import Historical Imagery */}
          <button
            onClick={() => setShowImageModal(true)}
            title="Import georeferenced historical imagery exported from Google Earth Pro"
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Satellite className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Import Historical</span>
          </button>

          {/* Transparency Info Modal */}
          <button
            onClick={() => setShowGeModal(true)}
            title="Satellite & Google Earth Integration Architecture"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 text-red-200 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Workspace Split Layout: Dual Map (Left) + Inspector Drawer (Right) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Dual Map Container */}
        <div className={`flex-1 h-full overflow-hidden relative ${mobileTab === 'audit' ? 'hidden lg:block' : 'block'}`}>
          <DualMapViewer
            lease={currentLease}
            analysisResult={analysisResult}
            selectedFeature={selectedFeature}
            onSelectFeature={(feat) => {
              handleFeatureClick(feat);
              // On mobile, if a feature is tapped, switch to audit tab so inspector can verify it
              if (window.innerWidth < 1024) {
                setMobileTab('audit');
              }
            }}
            importedLayers={importedLayers}
            importedGeojsonLayers={importedGeojsonList}
          />

          {/* Mobile Floating Audit Toggle */}
          {featuresList.length > 0 && mobileTab === 'map' && (
            <button
              onClick={() => setMobileTab('audit')}
              className="lg:hidden absolute bottom-3 right-3 z-30 flex items-center space-x-1.5 bg-slate-900/95 backdrop-blur border border-slate-700/90 text-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-2xl active:scale-95 transition min-h-[42px]"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Audit Features ({featuresList.length})</span>
            </button>
          )}
        </div>

        {/* Right Drawer: Inspector Feature Audit & Verification Console */}
        <div className={`w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex-col justify-between h-full flex-shrink-0 z-20 overflow-hidden shadow-2xl ${
          mobileTab === 'map' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Mobile Back to Map Bar */}
          <div className="lg:hidden p-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setMobileTab('map')}
              className="flex items-center space-x-1.5 text-xs text-blue-400 font-bold px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
            >
              <span>← Back to Dual Maps</span>
            </button>
            <span className="text-[11px] font-mono text-slate-400">
              {featuresList.length} candidate features
            </span>
          </div>

          {/* Drawer Header & Summary KPIs */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Candidate Feature Audit</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {featuresList.length} Features
              </span>
            </div>

            {/* Verification Status Counter Pills */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                <div className="text-slate-400">Candidate</div>
                <div className="font-bold text-white text-xs">{countCandidate}</div>
              </div>
              <div className="bg-emerald-950/50 border border-emerald-800/60 p-1.5 rounded">
                <div className="text-emerald-400">Confirmed</div>
                <div className="font-bold text-emerald-300 text-xs">{countConfirmed}</div>
              </div>
              <div className="bg-amber-950/50 border border-amber-800/60 p-1.5 rounded">
                <div className="text-amber-400">Field Verify</div>
                <div className="font-bold text-amber-300 text-xs">{countFieldVerify}</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/60 p-1.5 rounded">
                <div className="text-slate-400">Rejected</div>
                <div className="font-bold text-slate-300 text-xs">{countRejected}</div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1 pt-1 text-[10px]">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ENCROACHMENT', label: 'Encroachment', badge: 'Alert' },
                { id: 'INSIDE', label: 'Pit' },
                { id: 'BENCH', label: 'Benches' },
                { id: 'STOCKPILE', label: 'Stockpiles' },
                { id: 'ROAD', label: 'Roads' },
                { id: 'VEG', label: 'Veg' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryFilter(cat.id)}
                  className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                    activeCategoryFilter === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Features List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredFeatures.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                {featuresList.length === 0
                  ? 'No detected change features for this date period (Zero Change).'
                  : 'No features matching selected category filter.'}
              </div>
            ) : (
              filteredFeatures.map((feat) => {
                const isSelected = selectedFeature?.properties.id === feat.properties.id;
                const status = feat.properties.verification_status;
                const isOutside = feat.properties.category === 'POTENTIAL_ENCROACHMENT';

                let statusBadge = (
                  <span className="bg-slate-800 text-slate-400 text-[9px] px-1.5 py-0.5 rounded">
                    Candidate
                  </span>
                );
                if (status === 'CONFIRMED') {
                  statusBadge = (
                    <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-700 text-[9px] px-1.5 py-0.5 rounded font-bold">
                      CONFIRMED
                    </span>
                  );
                } else if (status === 'FIELD_VERIFY') {
                  statusBadge = (
                    <span className="bg-amber-900/60 text-amber-300 border border-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold">
                      FIELD VERIFY
                    </span>
                  );
                } else if (status === 'REJECTED') {
                  statusBadge = (
                    <span className="bg-slate-800 text-slate-400 line-through text-[9px] px-1.5 py-0.5 rounded">
                      REJECTED
                    </span>
                  );
                }

                return (
                  <div
                    key={feat.properties.id}
                    onClick={() => handleFeatureClick(feat)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition space-y-1 ${
                      isSelected
                        ? 'bg-slate-800 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                        : isOutside
                        ? 'bg-red-950/20 border-red-900/40 hover:bg-red-950/40'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: feat.properties.color || '#DC2626' }}
                        />
                        <span className="font-mono text-xs">{feat.properties.id}</span>
                        <span className="text-[11px] text-slate-300 truncate max-w-[130px]">
                          {feat.properties.feature_type}
                        </span>
                      </div>
                      {statusBadge}
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Area: <strong className="text-slate-200">{feat.properties.area_ha?.toFixed(2)} ha</strong> ({feat.properties.area_sqm?.toLocaleString()} m²)</span>
                      {feat.properties.distance_m ? (
                        <span className="text-red-400 font-semibold">~{feat.properties.distance_m}m Outside</span>
                      ) : (
                        <span>Inside Concession</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Selected Feature Verification Action Panel */}
          {selectedFeature ? (
            <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2.5 flex-shrink-0">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-200 flex items-center space-x-1">
                  <span>Inspector Decision:</span>
                  <span className="font-mono text-blue-400">{selectedFeature.properties.id}</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Confidence: {(selectedFeature.properties.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Inspector Action Buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleVerifyFeature('CONFIRMED')}
                  disabled={savingVerification}
                  className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                    selectedFeature.properties.verification_status === 'CONFIRMED'
                      ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400'
                      : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px]">Confirm</span>
                </button>

                <button
                  onClick={() => handleVerifyFeature('FIELD_VERIFY')}
                  disabled={savingVerification}
                  className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                    selectedFeature.properties.verification_status === 'FIELD_VERIFY'
                      ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-400'
                      : 'bg-amber-950/60 text-amber-400 border border-amber-800/80 hover:bg-amber-900'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[10px]">Field Verify</span>
                </button>

                <button
                  onClick={() => handleVerifyFeature('REJECTED')}
                  disabled={savingVerification}
                  className={`p-2 rounded-lg text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
                    selectedFeature.properties.verification_status === 'REJECTED'
                      ? 'bg-slate-700 text-white shadow-lg ring-2 ring-slate-400'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span className="text-[10px]">Reject</span>
                </button>
              </div>

              {/* Inspector Notes Field */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>Inspector Notes & Observation:</span>
                  {selectedFeature.properties.verified_at && (
                    <span className="text-emerald-400">Saved</span>
                  )}
                </div>
                <textarea
                  value={inspectorNotesInput}
                  onChange={(e) => setInspectorNotesInput(e.target.value)}
                  placeholder="e.g. Ground inspection confirms bench cut past northern pillar. Encroachment notice served."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Quick PDF Dossier Download button */}
              {analysisResult && (
                <a
                  href={`/api/reports/${analysisResult.analysis_id}/download`}
                  download
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center justify-center space-x-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Download Formal Inspection Dossier (PDF)</span>
                </a>
              )}
            </div>
          ) : (
            <div className="p-4 border-t border-slate-800 text-center text-slate-500 text-xs">
              Select any candidate feature above or click on map to review and record regulatory decision.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: IMPORT KML / KMZ LAYER */}
      {showKmlModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <UploadCloud className="w-4 h-4 text-violet-400" />
                <span>Import KML / KMZ Inspection Layer</span>
              </h3>
              <button onClick={() => setShowKmlModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleKmlUpload} className="space-y-3 text-xs">
              <p className="text-slate-400 leading-relaxed">
                Upload GPS field survey tracks, handheld boundary verifications, or prior mine plan KML/KMZ files.
              </p>
              <div>
                <label className="block text-slate-300 mb-1">Select KML or KMZ file:</label>
                <input
                  type="file"
                  accept=".kml,.kmz"
                  required
                  onChange={(e) => setKmlFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowKmlModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !kmlFile}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-semibold rounded-lg"
                >
                  {modalSubmitting ? 'Importing...' : 'Upload & Overlay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: IMPORT GEOREFERENCED GOOGLE EARTH PRO HISTORICAL IMAGERY */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Satellite className="w-4 h-4 text-amber-400" />
                <span>Import Georeferenced Historical Imagery</span>
              </h3>
              <button onClick={() => setShowImageModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-lg text-xs text-amber-300 space-y-1">
              <p className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Georeferencing Requirement Notice:</span>
              </p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Screenshots exported from Google Earth Pro lack embedded coordinate tags. Do not use unreferenced screenshots for legal area or royalty assessments. You must provide the 4 bounding coordinates below to georeference this raster.
              </p>
            </div>

            <form onSubmit={handleImageUpload} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Image File (PNG, JPG, GeoTIFF):</label>
                <input
                  type="file"
                  accept="image/*,.tif,.tiff"
                  required
                  onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Acquisition Date:</label>
                  <input
                    type="date"
                    value={imgDate}
                    onChange={(e) => setImgDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Imagery Source / Sensor:</label>
                  <input
                    type="text"
                    value={imgSource}
                    onChange={(e) => setImgSource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Bounding Box Coordinates (WGS84):</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500">North Lat (°N):</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={northLat}
                      onChange={(e) => setNorthLat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">South Lat (°N):</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={southLat}
                      onChange={(e) => setSouthLat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">East Lon (°E):</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={eastLon}
                      onChange={(e) => setEastLon(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">West Lon (°E):</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={westLon}
                      onChange={(e) => setWestLon(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs font-mono text-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || !imageFile}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white font-semibold rounded-lg"
                >
                  {modalSubmitting ? 'Registering...' : 'Georeference & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GOOGLE EARTH ARCHITECTURE & TRANSPARENCY NOTICE */}
      {showGeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Satellite Monitoring & Google Earth Integration Notice</span>
              </h3>
              <button onClick={() => setShowGeModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong>1. Authorized Satellite Imagery:</strong> AI-MIMS retrieves multi-temporal imagery directly from the <strong>Copernicus Sentinel-2 Constellation (L2A Surface Reflectance)</strong> at 10.0-meter spatial resolution. Actual overpass dates and vehicle IDs (e.g. Sentinel-2A / Sentinel-2B) are strictly recorded.
              </p>
              <p>
                <strong>2. Google Earth Pro Integration:</strong> Google Earth's historical satellite archive is proprietary and does not offer an authorized open API for automated raster analytics. Inspectors can click <em>"Launch in Google Earth Pro"</em> or <em>"Google Earth Web"</em> to conduct 3D visual cross-examination using the generated KML placemark file.
              </p>
              <p>
                <strong>3. 2D Surface Area Calculations:</strong> All surface disturbance areas are calculated using planar geometry projected into <strong>UTM Zone 43N (EPSG:32643)</strong>. Vertical bench depth and excavation tonnage cannot be inferred from 2D optical imagery alone without high-precision LiDAR or drone photogrammetry.
              </p>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowGeModal(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
