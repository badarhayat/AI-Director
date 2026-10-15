import React from 'react';
import { Shield, Satellite, RotateCcw, AlertTriangle, Menu } from 'lucide-react';
import { resetDemoData } from '../api/client';

interface NavbarProps {
  onRefresh?: () => void;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh, onToggleSidebar }) => {
  const [resetting, setResetting] = React.useState(false);

  const handleReset = async () => {
    if (confirm('Reset database with standard Punjab demonstration leases?')) {
      setResetting(true);
      try {
        await resetDemoData();
        if (onRefresh) onRefresh();
        alert('Demonstration leases reset successfully.');
      } catch (e: any) {
        alert('Failed to reset: ' + e.message);
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 focus:outline-none flex items-center justify-center min-w-[38px] min-h-[38px]"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex-shrink-0">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <h1 className="font-bold text-sm sm:text-base md:text-lg text-slate-100 tracking-tight">AI-MIMS</h1>
            <span className="text-[9px] sm:text-[10px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded border border-slate-700 font-mono">v1.0</span>
            <span className="hidden sm:inline text-xs font-semibold text-emerald-400 truncate">| Punjab Mining Surveillance</span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 truncate max-w-[140px] xs:max-w-[180px] sm:max-w-none">
            DGM&M • Punjab
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
        {/* Demo Mode Badge */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 bg-amber-500/10 border border-amber-500/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs text-amber-300 font-medium">
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="hidden md:inline">DEMO MODE • REGULATORY PROTOTYPE</span>
          <span className="md:hidden">DEMO</span>
        </div>

        {/* Sentinel-2 Provider status */}
        <div className="hidden lg:flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
          <Satellite className="w-3.5 h-3.5 text-blue-400" />
          <span>Sentinel-2 L2A</span>
        </div>

        {/* Reset Demo Data Button */}
        <button
          onClick={handleReset}
          disabled={resetting}
          title="Reset demonstration data"
          className="flex items-center space-x-1 text-[11px] sm:text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-slate-300 hover:text-white transition cursor-pointer min-h-[34px]"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          <span className="hidden xs:inline">{resetting ? 'Resetting...' : 'Reset'}</span>
        </button>
      </div>
    </header>
  );
};
