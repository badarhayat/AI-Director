import { Lease, AnalysisResult, DashboardStats, MineralProperty } from '../types';

const API_BASE = '/api';

export async function fetchLeases(): Promise<Lease[]> {
  const res = await fetch(`${API_BASE}/leases`);
  if (!res.ok) throw new Error('Failed to fetch leases');
  const data = await res.json();
  return data.leases;
}

export async function fetchLeaseDetails(leaseId: string): Promise<Lease> {
  const res = await fetch(`${API_BASE}/leases/${encodeURIComponent(leaseId)}`);
  if (!res.ok) throw new Error(`Failed to fetch lease details for ${leaseId}`);
  return await res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch dashboard statistics');
  return await res.json();
}

export async function runAnalysis(
  leaseId: string,
  startDate: string,
  endDate: string,
  options?: { assumedDepthM?: number; overrideDensity?: number }
): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/analysis/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lease_id: leaseId,
      start_date: startDate,
      end_date: endDate,
      assumed_depth_m: options?.assumedDepthM,
      override_density: options?.overrideDensity
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Analysis failed' }));
    throw new Error(err.detail || 'Analysis pipeline execution failed');
  }
  return await res.json();
}

export async function fetchAllAnalyses(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/analysis/all`);
  if (!res.ok) throw new Error('Failed to fetch analysis records');
  const data = await res.json();
  return data.analyses;
}

export async function updateReviewStatus(
  analysisId: string,
  status: string,
  remarks?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/analysis/${encodeURIComponent(analysisId)}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      review_status: status,
      reviewer_remarks: remarks
    })
  });
  if (!res.ok) throw new Error('Failed to update review status');
}

export async function fetchMinerals(): Promise<MineralProperty[]> {
  const res = await fetch(`${API_BASE}/minerals`);
  if (!res.ok) throw new Error('Failed to fetch mineral properties');
  const data = await res.json();
  return data.minerals;
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/leases/reset-demo-leases`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset demonstration data');
}

export async function verifyFeature(
  analysisId: string,
  featureId: string,
  status: 'CONFIRMED' | 'REJECTED' | 'FIELD_VERIFY' | 'CANDIDATE',
  inspectorNotes: string = '',
  inspectorName: string = 'DGM&M Senior Inspector'
): Promise<any> {
  const res = await fetch(`${API_BASE}/analysis/${encodeURIComponent(analysisId)}/verify-feature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feature_id: featureId,
      status: status,
      inspector_notes: inspectorNotes,
      inspector_name: inspectorName
    })
  });
  if (!res.ok) throw new Error('Failed to verify feature');
  return await res.json();
}

export async function fetchAnalysisFeatures(analysisId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/analysis/${encodeURIComponent(analysisId)}/features`);
  if (!res.ok) throw new Error('Failed to fetch features');
  return await res.json();
}

export async function importKmlLayer(formData: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/analysis/import-kml`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'KML import failed' }));
    throw new Error(err.detail || 'KML import failed');
  }
  return await res.json();
}

export async function importGeoreferencedImage(formData: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/analysis/import-georeferenced-image`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Image import failed' }));
    throw new Error(err.detail || 'Georeferenced image import failed');
  }
  return await res.json();
}

export async function fetchImportedLayers(leaseId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/analysis/imported-layers/${encodeURIComponent(leaseId)}`);
  if (!res.ok) throw new Error('Failed to fetch imported layers');
  const data = await res.json();
  return data.layers || [];
}
