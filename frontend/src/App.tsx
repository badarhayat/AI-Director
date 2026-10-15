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

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>('');
  const [alertCount, setAlertCount] = useState<number>(0);

  const refreshStats = () => {
    fetchDashboardStats()
      .then((s) => {
        if (s) setAlertCount(s.encroachment_alerts_count);
      })
      .catch((e) => console.error(e));
  };

  useEffect(() => {
    refreshStats();
  }, [currentTab]);

  const handleNavigateToMonitoring = (leaseId?: string) => {
    if (leaseId) setSelectedLeaseId(leaseId);
    setCurrentTab('monitoring');
  };

  const handleNavigateToInspection = (leaseId?: string) => {
    if (leaseId) setSelectedLeaseId(leaseId);
    setCurrentTab('inspection');
  };

  const handleNavigateToImport = () => {
    setCurrentTab('import');
  };

  const handleNavigateToCompliance = () => {
    setCurrentTab('compliance');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Top Government Navigation Header */}
      <Navbar onRefresh={refreshStats} />

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          encroachmentAlertCount={alertCount}
        />

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
