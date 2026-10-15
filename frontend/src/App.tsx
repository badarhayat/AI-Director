import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Monitoring } from './pages/Monitoring';
import { VisualInspectionWorkspace } from './pages/VisualInspectionWorkspace';
import { LeaseImport } from './pages/LeaseImport';
import { Compliance } from './pages/Compliance';
import { Environmental } from './pages/Environmental';
import { Production } from './pages/Production';
import { ReportsHistory } from './pages/ReportsHistory';
import { LeaseDirectory } from './pages/LeaseDirectory';
import { Settings } from './pages/Settings';
import { fetchDashboardStats } from './api/client';
import { App as CapApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { WifiOff, RefreshCw } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>('');
  const [alertCount, setAlertCount] = useState<number>(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  const refreshStats = () => {
    fetchDashboardStats()
      .then((s) => {
        if (s) setAlertCount(s.encroachment_alerts_count);
        setIsOffline(false);
      })
      .catch((e) => {
        console.error(e);
      });
  };

  useEffect(() => {
    refreshStats();
  }, [currentTab]);

  // Network offline / online detection
  useEffect(() => {
    const initNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setIsOffline(!status.connected);
      } catch {
        setIsOffline(!navigator.onLine);
      }
    };
    initNetwork();

    let netListener: any = null;
    Network.addListener('networkStatusChange', (status) => {
      setIsOffline(!status.connected);
      if (status.connected) {
        refreshStats();
      }
    }).then((l) => { netListener = l; });

    return () => {
      if (netListener) netListener.remove();
    };
  }, []);

  // Android hardware back button handling
  useEffect(() => {
    let backListener: any = null;
    CapApp.addListener('backButton', () => {
      if (isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      } else if (currentTab !== 'dashboard') {
        setCurrentTab('dashboard');
      } else {
        CapApp.minimizeApp();
      }
    }).then((l) => { backListener = l; });

    return () => {
      if (backListener) backListener.remove();
    };
  }, [isMobileSidebarOpen, currentTab]);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    setIsMobileSidebarOpen(false);
  };

  const handleNavigateToMonitoring = (leaseId?: string) => {
    if (leaseId) setSelectedLeaseId(leaseId);
    handleSelectTab('monitoring');
  };

  const handleNavigateToInspection = (leaseId?: string) => {
    if (leaseId) setSelectedLeaseId(leaseId);
    handleSelectTab('inspection');
  };

  const handleNavigateToImport = () => {
    handleSelectTab('import');
  };

  const handleNavigateToCompliance = () => {
    handleSelectTab('compliance');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Top Government Navigation Header */}
      <Navbar
        onRefresh={refreshStats}
        onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Offline Alert Ribbon */}
      {isOffline && (
        <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between text-xs font-medium z-50 shadow-md">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Offline Mode:</strong> Internet connection unavailable. AI-MIMS requires internet to communicate with the Punjab DGM&M server.
            </span>
          </div>
          <button
            onClick={refreshStats}
            className="flex items-center space-x-1 bg-amber-700 hover:bg-amber-800 px-2.5 py-1 rounded text-xs transition ml-2 flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <Sidebar
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            encroachmentAlertCount={alertCount}
          />
        </div>

        {/* Mobile Sidebar Overlay Drawer */}
        {isMobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            {/* Drawer */}
            <div className="relative z-50 w-72 max-w-[80vw] h-full bg-slate-900 shadow-2xl flex flex-col">
              <Sidebar
                currentTab={currentTab}
                onSelectTab={handleSelectTab}
                encroachmentAlertCount={alertCount}
              />
            </div>
          </div>
        )}

        {/* Dynamic Content Views */}
        <main className="flex-1 flex overflow-hidden">
          {currentTab === 'dashboard' && (
            <Dashboard
              onNavigateToMonitoring={handleNavigateToMonitoring}
              onNavigateToImport={handleNavigateToImport}
              onNavigateToCompliance={handleNavigateToCompliance}
            />
          )}

          {currentTab === 'monitoring' && (
            <Monitoring
              initialLeaseId={selectedLeaseId}
              onNavigateToImport={handleNavigateToImport}
              onNavigateToInspection={handleNavigateToInspection}
            />
          )}

          {currentTab === 'inspection' && (
            <VisualInspectionWorkspace
              initialLeaseId={selectedLeaseId}
              onNavigateToMonitoring={handleNavigateToMonitoring}
            />
          )}

          {currentTab === 'import' && (
            <LeaseImport
              onImportComplete={refreshStats}
              onNavigateToMonitoring={handleNavigateToMonitoring}
            />
          )}

          {currentTab === 'compliance' && (
            <Compliance onNavigateToMonitoring={handleNavigateToMonitoring} />
          )}

          {currentTab === 'environmental' && (
            <Environmental onNavigateToMonitoring={handleNavigateToMonitoring} />
          )}

          {currentTab === 'production' && <Production />}

          {currentTab === 'reports' && (
            <ReportsHistory onNavigateToMonitoring={handleNavigateToMonitoring} />
          )}

          {currentTab === 'leases' && (
            <LeaseDirectory
              onNavigateToMonitoring={handleNavigateToMonitoring}
              onNavigateToImport={handleNavigateToImport}
            />
          )}

          {currentTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;
