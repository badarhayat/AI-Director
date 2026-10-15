import React from 'react';
import { LayoutDashboard, Satellite, Eye, FileText, Menu } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenMore: () => void;
  encroachmentAlertCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMore,
  encroachmentAlertCount = 0
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'monitoring', label: 'Map/Analyze', icon: Satellite },
    { id: 'inspection', label: 'Dual Inspect', icon: Eye },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const isMoreActive = !tabs.some((t) => t.id === currentTab);

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center h-full w-full transition-colors relative py-1 focus:outline-none ${
                isActive
                  ? 'text-blue-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                {tab.id === 'monitoring' && encroachmentAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-slate-900" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
              {isActive && (
                <div className="absolute top-0 inset-x-3 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}

        {/* More Tab / Drawer Toggle */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center h-full w-full transition-colors relative py-1 focus:outline-none ${
            isMoreActive
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Menu className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            {encroachmentAlertCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-slate-900">
                {encroachmentAlertCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">
            {isMoreActive ? 'Other' : 'More'}
          </span>
          {isMoreActive && (
            <div className="absolute top-0 inset-x-3 h-0.5 bg-emerald-500 rounded-full" />
          )}
        </button>
      </div>
    </nav>
  );
};
