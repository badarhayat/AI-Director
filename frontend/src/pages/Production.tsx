import React, { useState, useEffect } from 'react';
import { MineralProperty } from '../types';
import { fetchMinerals } from '../api/client';
import { Scale, Calculator, Info, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Production: React.FC<ProductionProps> = () => {
  const [minerals, setMinerals] = useState<MineralProperty[]>([]);
  const [selectedMineral, setSelectedMineral] = useState<string>('Limestone');
  const [densityOverride, setDensityOverride] = useState<number | ''>('');
  const [excavationAreaSqm, setExcavationAreaSqm] = useState<number>(25000); // 2.5 ha default
  const [userVolumeM3, setUserVolumeM3] = useState<number | ''>('');
  const [assumedBenchDepthM, setAssumedBenchDepthM] = useState<number | ''>(12);
  const [wasteFraction, setWasteFraction] = useState<number>(0.15); // 15% waste
  const [recoveryRate, setRecoveryRate] = useState<number>(0.85); // 85% recovery

  useEffect(() => {
    fetchMinerals()
      .then((data) => setMinerals(data))
      .catch((e) => console.error(e));
  }, []);

  const currentMineralObj = minerals.find((m) => m.mineral_name.toLowerCase() === selectedMineral.toLowerCase()) || {
    mineral_name: 'Limestone',
    in_situ_bulk_density: 2.60,
    loose_bulk_density: 1.55,
    particle_density: 2.71,
    unit: 'tonnes/m³',
    source_reference: 'SME Mining Engineering Handbook (3rd Ed.)',
    source_url: 'https://mines.punjab.gov.pk'
  };

  const activeDensity = densityOverride !== '' ? Number(densityOverride) : currentMineralObj.in_situ_bulk_density;

  // Calculation
  let volumeM3: number | null = null;
  let calculationMode = 'NONE';

  if (userVolumeM3 !== '' && Number(userVolumeM3) > 0) {
    volumeM3 = Number(userVolumeM3);
    calculationMode = 'SITE_SURVEY';
  } else if (assumedBenchDepthM !== '' && Number(assumedBenchDepthM) > 0 && excavationAreaSqm > 0) {
    volumeM3 = excavationAreaSqm * Number(assumedBenchDepthM);
    calculationMode = 'ASSUMED_DEPTH';
  }

  const excavatedMassTonnes = volumeM3 ? volumeM3 * activeDensity : null;
  const wasteTonnes = excavatedMassTonnes ? excavatedMassTonnes * wasteFraction : null;
  const saleableTonnes = excavatedMassTonnes ? (excavatedMassTonnes - (wasteTonnes || 0)) * recoveryRate : null;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 pb-20 md:pb-6 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Scale className="w-6 h-6 text-blue-400" />
            <span>Geotechnical Mineral Properties & Production Estimator</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative rock density references and verified mass conversion equations.
            Distinguishes between particle density, in-situ bulk density, and loose bulk density.
          </p>
        </div>

        {/* Essential Scientific Limitation Notice */}
        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200 space-y-2">
          <div className="flex items-center space-x-2 font-bold text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>CRITICAL REGULATORY PRINCIPLE: 2D SATELLITE IMAGERY VS 3D ELEVATION SURFACES</span>
          </div>
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            Satellite imagery alone provides surface area footprints (m² or hectares).
            Excavation volume and tonnage cannot be reliably established without before-and-after 3D Digital Elevation Models (DEMs),
            LiDAR point clouds, or drone photogrammetry. Figures below illustrate formulaic conversions based on user-supplied survey inputs.
          </p>
        </div>

        {/* Section 1: Mineral Selection & Density Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <span>1. Authoritative Mineral Density Database (Punjab Basin)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Select Mineral:</label>
              <select
                value={selectedMineral}
                onChange={(e) => {
                  setSelectedMineral(e.target.value);
                  setDensityOverride('');
                }}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs font-semibold"
              >
                {minerals.map((m) => (
                  <option key={m.id} value={m.mineral_name}>
                    {m.mineral_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">In-situ Bulk Density (t/m³):</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.01"
                  value={densityOverride !== '' ? densityOverride : currentMineralObj.in_situ_bulk_density}
                  onChange={(e) => setDensityOverride(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold rounded-lg p-2 text-xs"
                />
                <span className="text-xs text-slate-400 font-mono">t/m³</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Editable site-measured value</span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Citation Reference:</label>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                <div className="font-medium text-slate-200">{currentMineralObj.source_reference}</div>
                {currentMineralObj.source_url && (
                  <a
                    href={currentMineralObj.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center space-x-1 mt-0.5 text-[10px]"
                  >
                    <span>View Reference Source</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Density Type Distinction Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 block">In-situ Bulk Density</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {currentMineralObj.in_situ_bulk_density} t/m³
              </span>
              <p className="text-[10px] text-slate-500 mt-1">Undisturbed bedrock in quarry face</p>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 block">Loose Bulk Density</span>
              <span className="text-lg font-bold text-amber-400 font-mono">
                {currentMineralObj.loose_bulk_density} t/m³
              </span>
              <p className="text-[10px] text-slate-500 mt-1">Blasted, fragmented rock in stockpiles</p>
            </div>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 block">Particle / Solid Density</span>
              <span className="text-lg font-bold text-blue-400 font-mono">
                {currentMineralObj.particle_density} t/m³
              </span>
              <p className="text-[10px] text-slate-500 mt-1">Zero-porosity mineral grain density</p>
            </div>
          </div>
        </div>

        {/* Section 2: Interactive Mass & Production Calculator */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>2. Production & Mass Estimation Calculator</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Excavation Footprint (m²):</label>
              <input
                type="number"
                value={excavationAreaSqm}
                onChange={(e) => setExcavationAreaSqm(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-lg p-2 text-xs"
              />
              <span className="text-[10px] text-slate-500">{(excavationAreaSqm / 10000).toFixed(2)} hectares</span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Assumed Bench Depth (m):</label>
              <input
                type="number"
                value={assumedBenchDepthM}
                onChange={(e) => {
                  setAssumedBenchDepthM(e.target.value === '' ? '' : Number(e.target.value));
                  setUserVolumeM3('');
                }}
                className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-lg p-2 text-xs"
              />
              <span className="text-[10px] text-slate-500">Illustrative bench cut depth</span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Waste / Overburden (%):</label>
              <input
                type="number"
                step="0.05"
                value={wasteFraction * 100}
                onChange={(e) => setWasteFraction(Number(e.target.value) / 100)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-lg p-2 text-xs"
              />
              <span className="text-[10px] text-slate-500">Unsaleable interburden ratio</span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Plant Recovery Rate (%):</label>
              <input
                type="number"
                step="0.05"
                value={recoveryRate * 100}
                onChange={(e) => setRecoveryRate(Number(e.target.value) / 100)}
                className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-lg p-2 text-xs"
              />
              <span className="text-[10px] text-slate-500">Crushing & screening yield</span>
            </div>
          </div>

          {/* Computed Results Matrix */}
          <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Geotechnical Output Matrix (Illustrative)
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-slate-400 block">Excavated Volume:</span>
                <span className="text-xl font-extrabold text-white font-mono">
                  {volumeM3 ? `${volumeM3.toLocaleString()} m³` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 block">Area × Bench Depth</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Excavated Rock Mass:</span>
                <span className="text-xl font-extrabold text-blue-400 font-mono">
                  {excavatedMassTonnes ? `${Math.round(excavatedMassTonnes).toLocaleString()} t` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 block">Volume × Bulk Density</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Waste / Overburden:</span>
                <span className="text-xl font-extrabold text-amber-400 font-mono">
                  {wasteTonnes ? `${Math.round(wasteTonnes).toLocaleString()} t` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 block">{wasteFraction * 100}% waste fraction</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Saleable Production:</span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  {saleableTonnes ? `${Math.round(saleableTonnes).toLocaleString()} t` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 block">Recoverable marketable yield</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProductionProps {}
