import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Lease, AnalysisResult, CandidateFeature, ImportedLayer } from '../types';
import {
  Layers,
  SplitSquareVertical,
  Sliders,
  Sparkles,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Calendar,
  Satellite,
  Compass
} from 'lucide-react';

interface DualMapViewerProps {
  lease?: Lease | null;
  analysisResult?: AnalysisResult | null;
  selectedFeature?: CandidateFeature | null;
  onSelectFeature?: (feature: CandidateFeature | null) => void;
  importedLayers?: ImportedLayer[];
  importedGeojsonLayers?: any[];
}

export const DualMapViewer: React.FC<DualMapViewerProps> = ({
  lease,
  analysisResult,
  selectedFeature,
  onSelectFeature,
  importedLayers = [],
  importedGeojsonLayers = []
}) => {
  // Container refs
  const containerBeforeRef = useRef<HTMLDivElement>(null);
  const containerAfterRef = useRef<HTMLDivElement>(null);
  const swipeWrapperRef = useRef<HTMLDivElement>(null);

  // Map instances
  const mapBeforeInstance = useRef<L.Map | null>(null);
  const mapAfterInstance = useRef<L.Map | null>(null);

  // Overlay layers refs
  const beforeOverlayRef = useRef<L.ImageOverlay | null>(null);
  const afterOverlayRef = useRef<L.ImageOverlay | null>(null);
  const changeOverlayRef = useRef<L.ImageOverlay | null>(null);
  const importedOverlayRef = useRef<L.ImageOverlay | null>(null);

  // Vector layers refs
  const vectorsBeforeRef = useRef<L.FeatureGroup | null>(null);
  const vectorsAfterRef = useRef<L.FeatureGroup | null>(null);
  const highlightBeforeRef = useRef<L.GeoJSON | null>(null);
  const highlightAfterRef = useRef<L.GeoJSON | null>(null);

  // Viewing Modes: 'split' | 'swipe' | 'opacity'
  const [viewMode, setViewMode] = useState<'split' | 'swipe' | 'opacity'>('split');
  const [swipePosition, setSwipePosition] = useState<number>(50); // 0 to 100%
  const [isDraggingSwipe, setIsDraggingSwipe] = useState<boolean>(false);
  const [opacityVal, setOpacityVal] = useState<number>(100);
  const [changeOverlayOpacity, setChangeOverlayOpacity] = useState<number>(80);
  const [isFlickering, setIsFlickering] = useState<boolean>(false);

  // Granular Feature & Layer Toggles
  const [showBoundary, setShowBoundary] = useState<boolean>(true);
  const [show1kmBuffer, setShow1kmBuffer] = useState<boolean>(true);
  const [showCandidateExcavation, setShowCandidateExcavation] = useState<boolean>(true);
  const [showEncroachment, setShowEncroachment] = useState<boolean>(true);
  const [showBenches, setShowBenches] = useState<boolean>(true);
  const [showStockpiles, setShowStockpiles] = useState<boolean>(true);
  const [showHaulRoads, setShowHaulRoads] = useState<boolean>(true);
  const [showVegLoss, setShowVegLoss] = useState<boolean>(true);
  const [showChangeOverlay, setShowChangeOverlay] = useState<boolean>(true);
  const [showImportedLayers, setShowImportedLayers] = useState<boolean>(true);

  // Base map style
  const [baseMapStyle, setBaseMapStyle] = useState<'satellite' | 'streets'>('satellite');
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Sync state locks to prevent recursive loops
  const isSyncingBefore = useRef(false);
  const isSyncingAfter = useRef(false);

  // Initialize Maps
  useEffect(() => {
    if (!containerBeforeRef.current || !containerAfterRef.current) return;
    if (mapBeforeInstance.current || mapAfterInstance.current) return;

    const defaultCenter: [number, number] = lease?.centroid || [32.75, 72.80];
    const defaultZoom = 13;

    // Map 1: BEFORE
    const mapB = L.map(containerBeforeRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false
    });

    // Map 2: AFTER
    const mapA = L.map(containerAfterRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false
    });

    // Base Layers
    const esriUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const streetUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const baseTileB = L.tileLayer(esriUrl, { maxZoom: 19 });
    const baseTileA = L.tileLayer(esriUrl, { maxZoom: 19 });

    baseTileB.addTo(mapB);
    baseTileA.addTo(mapA);

    // Synchronized Pan & Zoom handlers
    mapB.on('move', () => {
      if (isSyncingAfter.current) return;
      isSyncingBefore.current = true;
      mapA.setView(mapB.getCenter(), mapB.getZoom(), { animate: false });
      isSyncingBefore.current = false;
    });

    mapA.on('move', () => {
      if (isSyncingBefore.current) return;
      isSyncingAfter.current = true;
      mapB.setView(mapA.getCenter(), mapA.getZoom(), { animate: false });
      isSyncingAfter.current = false;
    });

    mapB.on('mousemove', (e) => {
      setMouseCoords({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) });
    });
    mapA.on('mousemove', (e) => {
      setMouseCoords({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) });
    });

    // Vector Groups
    vectorsBeforeRef.current = L.featureGroup().addTo(mapB);
    vectorsAfterRef.current = L.featureGroup().addTo(mapA);

    mapBeforeInstance.current = mapB;
    mapAfterInstance.current = mapA;

    return () => {
      mapB.remove();
      mapA.remove();
      mapBeforeInstance.current = null;
      mapAfterInstance.current = null;
    };
  }, []);

  // Update Centering when Lease changes
  useEffect(() => {
    if (!lease || !mapBeforeInstance.current || !mapAfterInstance.current) return;

    if (lease.bounds) {
      mapBeforeInstance.current.fitBounds(lease.bounds, { padding: [30, 30] });
    } else if (lease.centroid) {
      mapBeforeInstance.current.setView(lease.centroid, 14);
    }
  }, [lease]);

  // Blink / Flicker Timer
  useEffect(() => {
    if (!isFlickering) return;
    const interval = setInterval(() => {
      setOpacityVal((prev) => (prev > 50 ? 0 : 100));
    }, 700);
    return () => clearInterval(interval);
  }, [isFlickering]);

  // Handle Swipe dragging
  const handleMouseDownSwipe = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSwipe(true);
  };

  const handleMouseMoveSwipe = useCallback((e: MouseEvent) => {
    if (!isDraggingSwipe || !swipeWrapperRef.current) return;
    const rect = swipeWrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSwipePosition(pct);
  }, [isDraggingSwipe]);

  const handleMouseUpSwipe = useCallback(() => {
    setIsDraggingSwipe(false);
  }, []);

  useEffect(() => {
    if (isDraggingSwipe) {
      window.addEventListener('mousemove', handleMouseMoveSwipe);
      window.addEventListener('mouseup', handleMouseUpSwipe);
    } else {
      window.removeEventListener('mousemove', handleMouseMoveSwipe);
      window.removeEventListener('mouseup', handleMouseUpSwipe);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveSwipe);
      window.removeEventListener('mouseup', handleMouseUpSwipe);
    };
  }, [isDraggingSwipe, handleMouseMoveSwipe, handleMouseUpSwipe]);

  // Update Raster Satellite Overlays
  useEffect(() => {
    const mapB = mapBeforeInstance.current;
    const mapA = mapAfterInstance.current;
    if (!mapB || !mapA) return;

    // Clean existing raster overlays
    if (beforeOverlayRef.current) {
      mapB.removeLayer(beforeOverlayRef.current);
      beforeOverlayRef.current = null;
    }
    if (afterOverlayRef.current) {
      mapA.removeLayer(afterOverlayRef.current);
      afterOverlayRef.current = null;
    }
    if (changeOverlayRef.current) {
      mapA.removeLayer(changeOverlayRef.current);
      changeOverlayRef.current = null;
    }

    if (analysisResult?.imagery_previews) {
      const bounds = analysisResult.imagery_previews.bounds;
      const b64Before = analysisResult.imagery_previews.rgb_before_b64;
      const b64After = analysisResult.imagery_previews.rgb_after_b64;
      const b64Overlay = analysisResult.imagery_previews.rgb_overlay_b64;

      if (b64Before && bounds) {
        beforeOverlayRef.current = L.imageOverlay(b64Before, bounds, { opacity: 1.0 }).addTo(mapB);
      }
      if (b64After && bounds) {
        const afterOpacity = viewMode === 'opacity' ? opacityVal / 100 : 1.0;
        afterOverlayRef.current = L.imageOverlay(b64After, bounds, { opacity: afterOpacity }).addTo(mapA);
      }
      if (b64Overlay && bounds && showChangeOverlay) {
        changeOverlayRef.current = L.imageOverlay(b64Overlay, bounds, {
          opacity: changeOverlayOpacity / 100
        }).addTo(mapA);
      }
    }
  }, [analysisResult, viewMode, opacityVal, showChangeOverlay, changeOverlayOpacity]);

  // Update Opacity Dynamically on AFTER Overlay
  useEffect(() => {
    if (afterOverlayRef.current && viewMode === 'opacity') {
      afterOverlayRef.current.setOpacity(opacityVal / 100);
    }
  }, [opacityVal, viewMode]);

  // Update Vector Features & Boundaries
  useEffect(() => {
    const mapB = mapBeforeInstance.current;
    const mapA = mapAfterInstance.current;
    const groupB = vectorsBeforeRef.current;
    const groupA = vectorsAfterRef.current;
    if (!mapB || !mapA || !groupB || !groupA) return;

    groupB.clearLayers();
    groupA.clearLayers();

    // 1. Official Lease Boundary (Blue)
    if (showBoundary && lease?.boundary_geojson) {
      const boundaryStyle = {
        color: '#2563EB',
        weight: 3,
        opacity: 0.95,
        fillColor: '#3B82F6',
        fillOpacity: 0.12
      };
      L.geoJSON(lease.boundary_geojson, { style: boundaryStyle }).addTo(groupB);
      L.geoJSON(lease.boundary_geojson, { style: boundaryStyle }).addTo(groupA);
    }

    // 2. 1 KM Monitoring Zone (Cyan Dashed)
    if (show1kmBuffer && lease?.monitoring_zone_geojson) {
      const bufferStyle = {
        color: '#06B6D4',
        weight: 2,
        dashArray: '6, 6',
        opacity: 0.9,
        fillColor: '#22D3EE',
        fillOpacity: 0.05
      };
      L.geoJSON(lease.monitoring_zone_geojson, { style: bufferStyle }).addTo(groupB);
      L.geoJSON(lease.monitoring_zone_geojson, { style: bufferStyle }).addTo(groupA);
    }

    // 3. AI-Detected Candidate Features
    if (analysisResult?.features) {
      const allFeats = analysisResult.features.all_features || [
        ...(analysisResult.features.inside || []),
        ...(analysisResult.features.outside || [])
      ];

      allFeats.forEach((feat: CandidateFeature) => {
        const cat = feat.properties.category;
        const status = feat.properties.verification_status;

        // Visibility Filters
        if (cat === 'INSIDE_EXCAVATION' && !showCandidateExcavation) return;
        if (cat === 'POTENTIAL_ENCROACHMENT' && !showEncroachment) return;
        if (cat === 'CANDIDATE_BENCH' && !showBenches) return;
        if (cat === 'STOCKPILE' && !showStockpiles) return;
        if (cat === 'HAUL_ROAD' && !showHaulRoads) return;
        if (cat === 'VEGETATION_LOSS' && !showVegLoss) return;

        // Verification Status styling
        let color = feat.properties.color || '#DC2626';
        let fillColor = color;
        let opacity = 0.85;
        let fillOpacity = 0.45;
        let weight = 2;

        if (status === 'CONFIRMED') {
          color = '#10B981'; // Green
          fillColor = '#059669';
          weight = 3;
        } else if (status === 'FIELD_VERIFY') {
          color = '#F59E0B'; // Amber
          fillColor = '#D97706';
          weight = 3;
        } else if (status === 'REJECTED') {
          color = '#64748B'; // Slate gray
          fillColor = '#475569';
          opacity = 0.4;
          fillOpacity = 0.2;
        }

        const featStyle = {
          color: color,
          weight: weight,
          opacity: opacity,
          fillColor: fillColor,
          fillOpacity: fillOpacity
        };

        const onEachFeature = (feature: any, layer: L.Layer) => {
          layer.on({
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              if (onSelectFeature) onSelectFeature(feat);
            }
          });
        };

        // Add to BOTH maps so inspector compares before/after geometry
        L.geoJSON(feat.geometry, { style: featStyle, onEachFeature }).addTo(groupB);
        L.geoJSON(feat.geometry, { style: featStyle, onEachFeature }).addTo(groupA);
      });
    }

    // 4. Imported KML / External GeoJSON Layers
    if (showImportedLayers && importedGeojsonLayers.length > 0) {
      importedGeojsonLayers.forEach((layerData) => {
        const kmlStyle = {
          color: '#8B5CF6',
          weight: 3,
          dashArray: '3, 4',
          fillColor: '#A78BFA',
          fillOpacity: 0.25
        };
        L.geoJSON(layerData, { style: kmlStyle }).addTo(groupB);
        L.geoJSON(layerData, { style: kmlStyle }).addTo(groupA);
      });
    }
  }, [
    lease,
    analysisResult,
    showBoundary,
    show1kmBuffer,
    showCandidateExcavation,
    showEncroachment,
    showBenches,
    showStockpiles,
    showHaulRoads,
    showVegLoss,
    showImportedLayers,
    importedGeojsonLayers,
    onSelectFeature
  ]);

  // Selected Feature Highlight Halo & Center
  useEffect(() => {
    const mapB = mapBeforeInstance.current;
    const mapA = mapAfterInstance.current;
    if (!mapB || !mapA) return;

    if (highlightBeforeRef.current) {
      mapB.removeLayer(highlightBeforeRef.current);
      highlightBeforeRef.current = null;
    }
    if (highlightAfterRef.current) {
      mapA.removeLayer(highlightAfterRef.current);
      highlightAfterRef.current = null;
    }

    if (selectedFeature && selectedFeature.geometry) {
      const highlightStyle = {
        color: '#FFFFFF',
        weight: 4,
        dashArray: '4, 4',
        fillColor: '#F59E0B',
        fillOpacity: 0.65
      };

      highlightBeforeRef.current = L.geoJSON(selectedFeature.geometry, { style: highlightStyle }).addTo(mapB);
      highlightAfterRef.current = L.geoJSON(selectedFeature.geometry, { style: highlightStyle }).addTo(mapA);

      // Fit map view to the selected feature with comfortable padding
      const tempLayer = L.geoJSON(selectedFeature.geometry);
      const b = tempLayer.getBounds();
      if (b.isValid()) {
        mapB.fitBounds(b, { maxZoom: 17, padding: [80, 80] });
      }
    }
  }, [selectedFeature]);

  // Map Controls Helpers
  const handleZoomIn = () => {
    mapBeforeInstance.current?.zoomIn();
  };
  const handleZoomOut = () => {
    mapBeforeInstance.current?.zoomOut();
  };
  const handleResetView = () => {
    if (lease?.bounds) {
      mapBeforeInstance.current?.fitBounds(lease.bounds, { padding: [30, 30] });
    }
  };

  const meta = analysisResult?.satellite_metadata;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 select-none overflow-hidden relative">
      {/* Top Controls Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-20">
        {/* Mode Switchers */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] mr-1">
            Inspection Mode:
          </span>
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex space-x-1">
            <button
              onClick={() => { setViewMode('split'); setIsFlickering(false); }}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'split' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Dual Split (Sync)</span>
            </button>
            <button
              onClick={() => { setViewMode('swipe'); setIsFlickering(false); }}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'swipe' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Swipe Comparison</span>
            </button>
            <button
              onClick={() => { setViewMode('opacity'); }}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'opacity' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Opacity / Blink</span>
            </button>
          </div>

          {/* Opacity Mode Controls */}
          {viewMode === 'opacity' && (
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 ml-2">
              <span className="text-slate-400">T2 Blend:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={opacityVal}
                onChange={(e) => { setOpacityVal(Number(e.target.value)); setIsFlickering(false); }}
                className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="font-mono text-slate-200 text-[11px] w-8">{opacityVal}%</span>
              <button
                onClick={() => setIsFlickering(!isFlickering)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  isFlickering
                    ? 'bg-amber-500 text-black animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {isFlickering ? 'Blinking ON' : 'Blink Flicker'}
              </button>
            </div>
          )}

          {/* Change Overlay Slider */}
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 ml-2">
            <span className="text-slate-400">AI Overlay:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={changeOverlayOpacity}
              onChange={(e) => setChangeOverlayOpacity(Number(e.target.value))}
              className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <span className="font-mono text-slate-200 text-[11px]">{changeOverlayOpacity}%</span>
          </div>
        </div>

        {/* Zoom & Coordinates tracker */}
        <div className="flex items-center space-x-3">
          {mouseCoords && (
            <div className="text-slate-400 font-mono text-[11px] hidden sm:block bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {mouseCoords.lat.toFixed(5)}°N, {mouseCoords.lng.toFixed(5)}°E
            </div>
          )}

          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              title="Reset View"
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Feature Filter & Layer Toggles Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs z-10">
        <span className="text-slate-400 font-medium text-[11px]">Feature Layers:</span>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={showBoundary}
            onChange={(e) => setShowBoundary(e.target.checked)}
            className="rounded border-slate-700 text-blue-500"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            <span>Official Boundary</span>
          </span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={show1kmBuffer}
            onChange={(e) => setShow1kmBuffer(e.target.checked)}
            className="rounded border-slate-700 text-cyan-400"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block border border-dashed border-cyan-200"></span>
            <span>1 KM Buffer</span>
          </span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={showCandidateExcavation}
            onChange={(e) => setShowCandidateExcavation(e.target.checked)}
            className="rounded border-slate-700 text-red-500"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
            <span>Inside Excavation</span>
          </span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={showEncroachment}
            onChange={(e) => setShowEncroachment(e.target.checked)}
            className="rounded border-slate-700 text-red-400"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ring-2 ring-red-400/50"></span>
            <span className="font-semibold text-red-300">Encroachment Alert</span>
          </span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={showBenches}
            onChange={(e) => setShowBenches(e.target.checked)}
            className="rounded border-slate-700 text-purple-500"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
            <span>Candidate Benches</span>
          </span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={showStockpiles}
            onChange={(e) => setShowStockpiles(e.target.checked)}
            className="rounded border-slate-700 text-orange-500"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
            <span>Stockpiles</span>
          </span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={showHaulRoads}
            onChange={(e) => setShowHaulRoads(e.target.checked)}
            className="rounded border-slate-700 text-yellow-500"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
            <span>Haul Roads</span>
          </span>
        </label>

        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={showVegLoss}
            onChange={(e) => setShowVegLoss(e.target.checked)}
            className="rounded border-slate-700 text-pink-500"
          />
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block"></span>
            <span>Veg Loss</span>
          </span>
        </label>

        {importedGeojsonLayers.length > 0 && (
          <label className="flex items-center space-x-1.5 cursor-pointer text-violet-300 hover:text-white font-medium">
            <input
              type="checkbox"
              checked={showImportedLayers}
              onChange={(e) => setShowImportedLayers(e.target.checked)}
              className="rounded border-slate-700 text-violet-500"
            />
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block"></span>
              <span>Imported KML ({importedGeojsonLayers.length})</span>
            </span>
          </label>
        )}
      </div>

      {/* Main Map Workspace Canvas */}
      <div className="flex-1 w-full relative overflow-hidden" ref={swipeWrapperRef}>
        {/* VIEW MODE 1: SPLIT (Synchronized Panels) */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 md:grid-cols-2 h-full w-full divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {/* Left Panel: BEFORE (T1) */}
            <div className="relative h-full w-full">
              <div ref={containerBeforeRef} className="h-full w-full z-0" />
              {/* Header Badge: BEFORE */}
              <div className="absolute top-2.5 left-2.5 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs shadow-lg space-y-0.5">
                <div className="flex items-center space-x-1.5">
                  <span className="bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase">
                    BEFORE (T1)
                  </span>
                  <span className="font-semibold text-slate-200 text-[11px]">Baseline</span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-300 space-y-0.5">
                  <div className="flex justify-between space-x-2">
                    <span className="text-slate-400">Date:</span>
                    <span className="font-mono text-emerald-400 font-bold">{meta?.actual_start_date || '2024-01-10'}</span>
                  </div>
                  <div className="hidden sm:flex justify-between space-x-2">
                    <span className="text-slate-400">Sensor:</span>
                    <span className="text-slate-200">{meta?.satellite || 'Sentinel-2A'} (10m)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: AFTER (T2) */}
            <div className="relative h-full w-full">
              <div ref={containerAfterRef} className="h-full w-full z-0" />
              {/* Header Badge: AFTER */}
              <div className="absolute top-2.5 left-2.5 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs shadow-lg space-y-0.5">
                <div className="flex items-center space-x-1.5">
                  <span className="bg-amber-600 text-white font-bold px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase">
                    AFTER (T2)
                  </span>
                  <span className="font-semibold text-slate-200 text-[11px]">Surveillance</span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-300 space-y-0.5">
                  <div className="flex justify-between space-x-2">
                    <span className="text-slate-400">Date:</span>
                    <span className="font-mono text-emerald-400 font-bold">{meta?.actual_end_date || '2024-04-09'}</span>
                  </div>
                  <div className="hidden sm:flex justify-between space-x-2">
                    <span className="text-slate-400">Sensor:</span>
                    <span className="text-slate-200">{meta?.satellite || 'Sentinel-2A'} (10m)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 2: SWIPE (Interactive Draggable Comparison) */}
        {viewMode === 'swipe' && (
          <div className="relative h-full w-full overflow-hidden">
            {/* Bottom Layer: AFTER (T2) */}
            <div ref={containerAfterRef} className="absolute inset-0 z-0 h-full w-full" />

            {/* Top Layer: BEFORE (T1) with Clip Path */}
            <div
              ref={containerBeforeRef}
              className="absolute inset-0 z-10 h-full w-full pointer-events-none"
              style={{
                clipPath: `inset(0px ${(100 - swipePosition).toFixed(2)}% 0px 0px)`
              }}
            />

            {/* Draggable Vertical Divider Handle */}
            <div
              className="absolute top-0 bottom-0 z-30 w-1 bg-white shadow-2xl cursor-ew-resize flex items-center justify-center select-none"
              style={{ left: `${swipePosition}%` }}
              onMouseDown={handleMouseDownSwipe}
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white text-white shadow-xl flex items-center justify-center transform -translate-x-1/2 cursor-ew-resize">
                <SplitSquareVertical className="w-4 h-4" />
              </div>
            </div>

            {/* Labels on Swipe mode */}
            <div className="absolute top-3 left-3 z-20 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-blue-400 shadow">
              ◄ BEFORE: {meta?.actual_start_date || 'T1'}
            </div>
            <div className="absolute top-3 right-3 z-20 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-amber-400 shadow">
              AFTER: {meta?.actual_end_date || 'T2'} ►
            </div>
          </div>
        )}

        {/* VIEW MODE 3: OPACITY BLEND / FLICKER BLINK */}
        {viewMode === 'opacity' && (
          <div className="relative h-full w-full">
            <div ref={containerAfterRef} className="h-full w-full z-0" />
            <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
              <div className="flex items-center space-x-2">
                <span className="bg-purple-600 text-white font-bold px-2 py-0.5 rounded text-[10px] tracking-wider uppercase">
                  OPACITY COMPARISON
                </span>
                <span className="text-slate-300">
                  {isFlickering ? 'Rapid Blink Active' : `T2 Opacity: ${opacityVal}%`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs">
                {isFlickering
                  ? 'Blinking alternates between T1 and T2 to visually highlight ground excavation and bench cutting.'
                  : 'Adjust slider above to blend recent satellite observations over historical baseline.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Technical Notice Banner */}
      <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 z-10">
        <div className="flex items-center space-x-2">
          <Satellite className="w-3.5 h-3.5 text-blue-400" />
          <span>
            Imagery Source:{' '}
            <strong className="text-slate-200">
              {meta?.imagery_source || 'Copernicus Sentinel-2 L2A'} ({meta?.resolution_m || 10.0}m/px)
            </strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Projected CRS: <strong className="text-slate-200">EPSG:32643 (UTM Zone 43N)</strong>
          </span>
        </div>
        <div className="text-slate-400 text-right">
          <span>*Bench crest delineation from 10m imagery is tentative; drone photogrammetry or high-res (&lt;0.5m) recommended.</span>
        </div>
      </div>
    </div>
  );
};
