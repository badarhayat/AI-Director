import React from 'react';
import { Sliders, Compass, Database, Satellite, ShieldCheck, Map } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Sliders className="w-6 h-6 text-blue-400" />
            <span>System Architecture & Geodetic Parameters</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Core configuration for the AI Mining Inspection and Monitoring System (AI-MIMS) demonstration prototype.
          </p>
        </div>

        {/* CRS Specifications */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>Geodetic & Coordinate Reference Systems (CRS)</span>
          </h2>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center">
                <strong className="text-white">Projected CRS (Area & Buffer Calculations):</strong>
                <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                  EPSG:32643 (WGS 84 / UTM Zone 43N)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Standard Universal Transverse Mercator (UTM) zone covering the Salt Range, Potohar Plateau, Chakwal, Rawalpindi, Jhelum, and Lahore.
                Preserves metric distance so that 1,000-metre outer buffers and square-metre areas are calculated with zero angular distortion.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center">
                <strong className="text-white">Geographic CRS (Storage & Web Display):</strong>
                <span className="font-mono text-blue-400 font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800">
                  EPSG:4326 (WGS 84 Lat/Lon Degrees)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Standard latitude/longitude coordinates used for GeoJSON, KML export for Google Earth, and web mapping viewports.
              </p>
            </div>
          </div>
        </div>

        {/* 1 KM Buffer Specification */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3 text-xs text-slate-300">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Map className="w-4 h-4 text-cyan-400" />
            <span>Mandatory 1 KM Surrounding Monitoring Zone</span>
          </h2>
          <p className="leading-relaxed text-slate-400">
            Section 7 compliance: Every monitored lease automatically constructs an outward buffer of exactly <strong>1,000 metres (1 kilometre)</strong> from the official legal boundary.
            The surrounding monitoring zone is calculated in UTM 43N projected space as:
          </p>
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-cyan-300 text-[11px]">
            Surrounding_Zone = Buffer(Lease_Polygon, 1000m) - Lease_Polygon
          </div>
          <p className="text-[11px] text-slate-500">
            Note: The 1 km buffer is an analytical monitoring envelope, not an extension of the legal leasehold.
          </p>
        </div>

        {/* Database & Deployment */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3 text-xs text-slate-300">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Database className="w-4 h-4 text-purple-400" />
            <span>Database & Storage Architecture</span>
          </h2>
          <p className="leading-relaxed text-slate-400">
            Demonstration operates on an embedded SQLite database (<code className="text-purple-300 font-mono">backend/app/data/mims.db</code>) with full GeoJSON geometry serialization.
            The database schema is strictly normalized and ready for seamless migration to <strong>PostgreSQL with PostGIS extension</strong> for enterprise multi-district provincial deployments.
          </p>
        </div>
      </div>
    </div>
  );
};
