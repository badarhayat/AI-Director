import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Lease, AnalysisResult } from '../types';
import { Legend } from './Legend';
import { ExternalLink, Download, FileText, Layers, Compass, Image as ImageIcon } from 'lucide-react';

interface MapViewerProps {
  lease?: Lease | null;
  analysisResult?: AnalysisResult | null;
  onDownloadPdf?: () => void;
  onDownloadKml?: () => void;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  lease,
  analysisResult,
  onDownloadPdf,
  onDownloadKml
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const baseLayersRef = useRef<{ [key: string]: L.TileLayer }>({});
  const leaseLayerRef = useRef<L.GeoJSON | null>(null);
  const bufferLayerRef = useRef<L.GeoJSON | null>(null);
  const featuresLayerRef = useRef<L.GeoJSON | null>(null);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeBaseLayer, setActiveBaseLayer] = useState<'satellite' | 'street'>('satellite');
  const [show1kmBuffer, setShow1kmBuffer] = useState<boolean>(true);
  const [showInsideDisturbance, setShowInsideDisturbance] = useState<boolean>(true);
  const [showOutsideEncroachment, setShowOutsideEncroachment] = useState<boolean>(true);
  const [showVegetationLoss, setShowVegetationLoss] = useState<boolean>(true);
  const [imageMode, setImageMode] = useState<'none' | 'before' | 'after' | 'overlay'>('overlay');
  const [showLegend, setShowLegend] = useState<boolean>(true);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [32.75, 72.8],
      zoom: 12,
      zoomControl: true
    });

    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    map.on('mousemove', (e) => {
      setMouseCoords({
        lat: Number(e.latlng.lat.toFixed(5)),
        lng: Number(e.latlng.lng.toFixed(5))
      });
    });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
      }
    );

    const streetLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19
      }
    );

    baseLayersRef.current = { satellite: satelliteLayer, street: streetLayer };
    satelliteLayer.addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Basemap Switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !baseLayersRef.current.satellite) return;

    if (activeBaseLayer === 'satellite') {
      map.removeLayer(baseLayersRef.current.street);
      baseLayersRef.current.satellite.addTo(map);
    } else {
      map.removeLayer(baseLayersRef.current.satellite);
      baseLayersRef.current.street.addTo(map);
    }
  }, [activeBaseLayer]);

  // When analysisResult updates, automatically activate the overlay mode
  useEffect(() => {
    if (analysisResult) {
      setImageMode('overlay');
    }
  }, [analysisResult]);

  // Handle Lease & 1km Buffer Geometry Rendering
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (leaseLayerRef.current) {
      map.removeLayer(leaseLayerRef.current);
      leaseLayerRef.current = null;
    }
    if (bufferLayerRef.current) {
      map.removeLayer(bufferLayerRef.current);
      bufferLayerRef.current = null;
    }

    if (!lease || !lease.boundary_geojson) return;

    // 1. Mandatory 1 KM Buffer Ring (Cyan dashed outline)
    if (lease.monitoring_zone_geojson && show1kmBuffer) {
      const bufferGeoJson = L.geoJSON(lease.monitoring_zone_geojson, {
        style: {
          color: '#06B6D4',
          weight: 2,
          dashArray: '6, 6',
          fillColor: '#06B6D4',
          fillOpacity: 0.08
        }
      }).bindTooltip('<b>1 KM SURROUNDING MONITORING ZONE</b><br/>Outer 1,000m surveillance boundary', {
        sticky: true
      });
      bufferGeoJson.addTo(map);
      bufferLayerRef.current = bufferGeoJson;
    }

    // 2. Official Lease Boundary (Blue solid outline)
    const leaseGeoJson = L.geoJSON(lease.boundary_geojson, {
      style: {
        color: '#2563EB',
        weight: 3,
        fillColor: '#3B82F6',
        fillOpacity: 0.12
      }
    }).bindPopup(`
      <div style="font-family:sans-serif; min-width:200px; color:#0f172a">
        <h4 style="margin:0 0 4px; color:#1e3a8a; font-weight:700;">${lease.quarry_name}</h4>
        <div style="font-size:12px; line-height:1.4;">
          <b>Lease ID:</b> ${lease.lease_id}<br/>
          <b>Mineral:</b> ${lease.mineral}<br/>
          <b>District:</b> ${lease.district}<br/>
          <b>Lessee:</b> ${lease.company_name || 'N/A'}<br/>
          <b>Official Area:</b> ${lease.lease_area_ha} ha<br/>
          <b>Computed (UTM 43N):</b> ${lease.calculated_area_ha} ha
        </div>
      </div>
    `);
    leaseGeoJson.addTo(map);
    leaseLayerRef.current = leaseGeoJson;

    // Auto Zoom & Fit Bounds
    if (bufferLayerRef.current) {
      map.fitBounds(bufferLayerRef.current.getBounds(), { padding: [30, 30], maxZoom: 16 });
    } else {
      map.fitBounds(leaseGeoJson.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
  }, [lease, show1kmBuffer]);

  // Handle Analysis Feature Layers (Inside disturbance, outside encroachment, vegetation loss)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (featuresLayerRef.current) {
      map.removeLayer(featuresLayerRef.current);
      featuresLayerRef.current = null;
    }

    if (!analysisResult || !analysisResult.features) return;

    const allFeatures: any[] = [];

    if (showInsideDisturbance && analysisResult.features.inside) {
      allFeatures.push(...analysisResult.features.inside);
    }
    if (showOutsideEncroachment && analysisResult.features.outside) {
      allFeatures.push(...analysisResult.features.outside);
    }
    if (showVegetationLoss && analysisResult.features.vegetation_loss) {
      allFeatures.push(...analysisResult.features.vegetation_loss);
    }

    if (allFeatures.length === 0) return;

    const layer = L.geoJSON(
      {
        type: 'FeatureCollection',
        features: allFeatures
      } as any,
      {
        style: (feature: any) => {
          const cat = feature?.properties?.category;
          if (cat === 'POTENTIAL_ENCROACHMENT') {
            return {
              color: '#991B1B',
              weight: 3,
              fillColor: '#EF4444',
              fillOpacity: 0.65
            };
          } else if (cat === 'INSIDE_EXCAVATION') {
            return {
              color: '#B91C1C',
              weight: 2,
              fillColor: '#DC2626',
              fillOpacity: 0.5
            };
          } else if (cat === 'VEGETATION_LOSS') {
            return {
              color: '#BE185D',
              weight: 1.5,
              fillColor: '#DB2777',
              fillOpacity: 0.45
            };
          }
          return {
            color: '#F97316',
            weight: 2,
            fillColor: '#FB923C',
            fillOpacity: 0.5
          };
        },
        onEachFeature: (feature, l) => {
          const p = feature.properties || {};
          const isEncroachment = p.category === 'POTENTIAL_ENCROACHMENT';

          const content = `
            <div style="font-family:sans-serif; min-width:220px; color:#0f172a">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="font-weight:bold; font-size:13px; color:${isEncroachment ? '#b91c1c' : '#1e293b'}">
                  ${isEncroachment ? '⚠️ POTENTIAL ENCROACHMENT' : p.feature_type || 'Detected Change'}
                </span>
              </div>
              <div style="font-size:12px; line-height:1.4;">
                <b>Category:</b> ${p.category}<br/>
                <b>Affected Area:</b> ${p.area_ha?.toFixed(3)} ha (${Number(p.area_sqm).toLocaleString()} m²)<br/>
                ${p.distance_m ? `<b>Distance Beyond Boundary:</b> ~${p.distance_m} m<br/>` : ''}
                <div style="margin-top:6px; padding:4px 6px; background:${isEncroachment ? '#fef2f2' : '#f1f5f9'}; border-radius:4px; font-size:11px; color:${isEncroachment ? '#991b1b' : '#475569'}">
                  ${p.description || (isEncroachment ? 'Requires immediate field verification' : 'Authorized quarry excavation')}
                </div>
              </div>
            </div>
          `;
          l.bindPopup(content);
        }
      }
    );

    layer.addTo(map);
    featuresLayerRef.current = layer;
  }, [analysisResult, showInsideDisturbance, showOutsideEncroachment, showVegetationLoss]);

  // Handle Satellite Raster Overlays (Before / After / Difference Overlay)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (imageOverlayRef.current) {
      map.removeLayer(imageOverlayRef.current);
      imageOverlayRef.current = null;
    }

    if (!analysisResult || imageMode === 'none') return;

    let imageUrl: string | null = null;
    if (imageMode === 'before') {
      imageUrl = analysisResult.imagery_previews.rgb_before_b64;
    } else if (imageMode === 'after') {
      imageUrl = analysisResult.imagery_previews.rgb_after_b64;
    } else if (imageMode === 'overlay') {
      imageUrl = analysisResult.imagery_previews.rgb_overlay_b64;
    }

    if (imageUrl && analysisResult.imagery_previews.bounds) {
      const bounds = analysisResult.imagery_previews.bounds;
      const overlay = L.imageOverlay(imageUrl, bounds, { opacity: 0.90 });
      overlay.addTo(map);
      imageOverlayRef.current = overlay;
    }
  }, [imageMode, analysisResult]);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Top Map Action Toolbar */}
      <div className="absolute top-3 left-14 z-30 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-2 rounded-xl shadow-lg">
        {/* Basemap Selector */}
        <div className="flex items-center space-x-1 border-r border-slate-700 pr-3">
          <button
            onClick={() => setActiveBaseLayer('satellite')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
              activeBaseLayer === 'satellite' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Esri Satellite
          </button>
          <button
            onClick={() => setActiveBaseLayer('street')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
              activeBaseLayer === 'street' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Streets
          </button>
        </div>

        {/* 1 KM Buffer Toggle */}
        <button
          onClick={() => setShow1kmBuffer(!show1kmBuffer)}
          className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
            show1kmBuffer ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>1 KM Buffer</span>
        </button>

        {/* Satellite Imagery Raster Switcher */}
        {analysisResult && (
          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-lg border border-slate-700 ml-1">
            <span className="text-[11px] text-slate-400 px-1 font-semibold flex items-center space-x-1">
              <ImageIcon className="w-3 h-3 text-blue-400" />
              <span>Imagery:</span>
            </span>
            <button
              onClick={() => setImageMode('before')}
              className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                imageMode === 'before' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title={`View baseline satellite imagery (${analysisResult.satellite_metadata.actual_start_date})`}
            >
              T1 Baseline
            </button>
            <button
              onClick={() => setImageMode('after')}
              className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                imageMode === 'after' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title={`View recent satellite imagery (${analysisResult.satellite_metadata.actual_end_date})`}
            >
              T2 Recent
            </button>
            <button
              onClick={() => setImageMode('overlay')}
              className={`px-2 py-0.5 text-xs rounded transition cursor-pointer ${
                imageMode === 'overlay' ? 'bg-red-600 text-white font-bold animate-pulse' : 'text-slate-400 hover:text-white'
              }`}
              title="View change detection & boundary compliance overlay"
            >
              Change Overlay
            </button>
            <button
              onClick={() => setImageMode('none')}
              className={`px-1.5 py-0.5 text-[11px] rounded transition cursor-pointer ${
                imageMode === 'none' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-400'
              }`}
              title="Turn off satellite raster overlay"
            >
              Off
            </button>
          </div>
        )}

        {/* Vector Feature Layer Toggles */}
        {analysisResult && (
          <div className="flex items-center space-x-1 border-l border-slate-700 pl-2">
            <button
              onClick={() => setShowInsideDisturbance(!showInsideDisturbance)}
              className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-lg transition cursor-pointer ${
                showInsideDisturbance ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Inside Pit</span>
            </button>

            <button
              onClick={() => setShowOutsideEncroachment(!showOutsideEncroachment)}
              className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-lg transition cursor-pointer ${
                showOutsideEncroachment ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span>⚠️ Encroachment</span>
            </button>

            <button
              onClick={() => setShowVegetationLoss(!showVegetationLoss)}
              className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-lg transition cursor-pointer ${
                showVegetationLoss ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              <span>NDVI</span>
            </button>
          </div>
        )}
      </div>

      {/* Top Right Integration Actions (Google Earth, KML, PDF) */}
      <div className="absolute top-3 right-3 z-30 flex items-center space-x-2">
        {lease?.google_earth_url && (
          <a
            href={lease.google_earth_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open quarry boundary in Google Earth Web"
            className="flex items-center space-x-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md transition"
          >
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>Google Earth</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        )}

        {analysisResult && (
          <>
            <button
              onClick={onDownloadKml}
              title="Export KML polygons for Google Earth desktop"
              className="flex items-center space-x-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export KML</span>
            </button>

            <button
              onClick={onDownloadPdf}
              title="Download official PDF inspection report"
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF Report</span>
            </button>
          </>
        )}

        <button
          onClick={() => setShowLegend(!showLegend)}
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 p-1.5 rounded-lg shadow-md transition cursor-pointer"
          title="Toggle Symbology Legend"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Legend */}
      {showLegend && (
        <div className="absolute bottom-6 right-3 z-30 max-w-xs">
          <Legend />
        </div>
      )}

      {/* Bottom Coordinates & Acquisition Status bar */}
      <div className="absolute bottom-2 left-24 z-30 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1 rounded-md text-[11px] text-slate-400 flex items-center space-x-4 shadow">
        <div>
          <span>Coordinates: </span>
          <span className="font-mono text-slate-200">
            {mouseCoords ? `${mouseCoords.lat.toFixed(5)}°N, ${mouseCoords.lng.toFixed(5)}°E` : 'Hover on map'}
          </span>
        </div>
        <div className="border-l border-slate-700 pl-3">
          <span>CRS: </span>
          <span className="font-mono text-slate-200">EPSG:32643 (UTM 43N)</span>
        </div>
        {analysisResult && (
          <div className="border-l border-slate-700 pl-3 flex items-center space-x-1.5">
            <span className="text-slate-400">Overpasses:</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {analysisResult.satellite_metadata.actual_start_date} → {analysisResult.satellite_metadata.actual_end_date}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
