import React from 'react';

interface LegendProps {
  className?: string;
}

export const Legend: React.FC<LegendProps> = ({ className = '' }) => {
  const legendItems = [
    { label: 'Official Lease Boundary', color: '#2563EB', type: 'border', desc: 'Authoritative legal perimeter' },
    { label: '1 KM Monitoring Zone', color: '#06B6D4', type: 'dashed', desc: 'Mandatory 1,000m buffer' },
    { label: 'New Disturbance (Inside Lease)', color: '#DC2626', type: 'fill', desc: 'Permitted excavation pit' },
    { label: 'Potential Outside Encroachment', color: '#EF4444', type: 'double', desc: 'ALERT: Excavation outside lease' },
    { label: 'Stockpiles / Overburden', color: '#F97316', type: 'fill', desc: 'Material storage / dumps' },
    { label: 'New Haul Roads', color: '#EAB308', type: 'line', desc: 'Access tracks & haulage' },
    { label: 'Vegetation Cover Loss', color: '#DB2777', type: 'fill', desc: 'Significant NDVI reduction' },
    { label: 'Water / Drainage Changes', color: '#1E3A8A', type: 'fill', desc: 'Potential stream diversion' },
    { label: 'Field Verification Required', color: '#F59E0B', type: 'fill', desc: 'Requires site inspection' }
  ];

  return (
    <div className={`bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-3 text-xs shadow-xl ${className}`}>
      <div className="font-semibold text-slate-200 mb-2 pb-1 border-b border-slate-800 flex items-center justify-between">
        <span>Map Symbology Legend</span>
        <span className="text-[10px] text-slate-400 font-mono">DGM&M Standard</span>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex items-center space-x-2.5">
            <div className="w-5 h-3 flex-shrink-0 flex items-center justify-center">
              {item.type === 'border' && (
                <div className="w-full h-full border-2 border-blue-600 bg-blue-500/20 rounded-xs" />
              )}
              {item.type === 'dashed' && (
                <div className="w-full h-full border-2 border-dashed border-cyan-400 bg-cyan-400/10 rounded-xs" />
              )}
              {item.type === 'fill' && (
                <div className="w-full h-full rounded-xs opacity-90" style={{ backgroundColor: item.color }} />
              )}
              {item.type === 'double' && (
                <div
                  className="w-full h-full rounded-xs border-2 border-red-950 animate-pulse"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {item.type === 'line' && (
                <div className="w-full h-1 rounded" style={{ backgroundColor: item.color }} />
              )}
            </div>
            <div className="leading-tight">
              <span className="text-slate-200 font-medium">{item.label}</span>
              <span className="text-[10px] text-slate-400 block">{item.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
