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
    <header className="bg-slate-900 border-b border-slate-800 text-white px-4 md:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center space-x-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base md:text-lg text-slate-100 tracking-tight">AI-MIMS</h1>
            <span className="text-[10px] md:text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">v1.0</span>
            <span className="hidden sm:inline text-xs font-semibold text-emerald-400">| Punjab Mining Surveillance</span>
          </div>
          <p className="text-[10px] md:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
            DGM&M • Government of the Punjab
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Demo Mode Badge */}
        <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-xs text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="font-medium tracking-wide">DEMO MODE • REGULATORY PROTOTYPE</span>
        </div>

        {/* Sentinel-2 Provider status */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
          <Satellite className="w-3.5 h-3.5 text-blue-400" />
          <span>Sentinel-2 L2A (10m)</span>
        </div>

        {/* Reset Demo Data Button */}
        <button
          onClick={handleReset}
          disabled={resetting}
          title="Reset demonstration data"
          className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          <span>{resetting ? 'Resetting...' : 'Reset Demo'}</span>
        </button>
      </div>
    </header>
  );
};
