import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Layers,
  Satellite,
  ShieldAlert,
  Trees,
  Scale,
  FileText,
  Sliders,
  Eye
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  encroachmentAlertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  encroachmentAlertCount = 0
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'import', label: 'Lease Import (CSV)', icon: UploadCloud, badge: 'Bulk' },
    { id: 'monitoring', label: 'Satellite Monitoring', icon: Satellite },
    { id: 'inspection', label: 'Visual Inspection Workspace', icon: Eye, badge: 'Dual-Sync', highlight: true },
    { id: 'compliance', label: 'Boundary Compliance', icon: ShieldAlert, alertCount: encroachmentAlertCount },
    { id: 'environmental', label: 'Environmental / NDVI', icon: Trees },
    { id: 'production', label: 'Production Estimation', icon: Scale },
    { id: 'reports', label: 'Inspection Reports', icon: FileText },
    { id: 'leases', label: 'Lease Directory', icon: Layers },
    { id: 'settings', label: 'System & CRS Settings', icon: Sliders }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-[calc(100vh-61px)] flex-shrink-0">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Surveillance Console
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                } ${item.highlight && !isActive ? 'border border-blue-500/30 bg-blue-500/5 text-blue-300' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.alertCount !== undefined && item.alertCount > 0 && (
                  <span className="bg-red-500 text-white text-[11px] px-2 py-0.2 rounded-full font-bold">
                    {item.alertCount}
                  </span>
                )}

                {item.badge && (
                  <span className="bg-slate-800 text-slate-400 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400 space-y-2">
        <div className="flex justify-between items-center">
          <span>Projected CRS</span>
          <span className="font-mono text-slate-200">EPSG:32643 (UTM 43N)</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Monitoring Buffer</span>
          <span className="font-mono text-emerald-400 font-bold">1,000 m (1 KM)</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Jurisdiction</span>
          <span className="text-slate-200">Punjab, Pakistan</span>
        </div>
      </div>
    </aside>
  );
};
