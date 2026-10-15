export interface Lease {
  id: number;
  lease_id: string;
  quarry_name: string;
  mineral: string;
  district: string;
  company_name: string;
  lease_status: string;
  lease_area_ha: number;
  calculated_area_ha: number;
  boundary_geojson?: any;
  monitoring_zone_geojson?: any;
  centroid?: [number, number];
  bounds?: [[number, number], [number, number]];
  google_earth_url?: string;
  created_at?: string;
}

export interface SatelliteMetadata {
  requested_start_date: string;
  requested_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  imagery_source: string;
  satellite: string;
  resolution_m: number;
  cloud_cover_start_pct: number;
  cloud_cover_end_pct: number;
  sensor: string;
  projection: string;
  is_demonstration_source: boolean;
  notes: string;
}

export interface AnalysisMetrics {
  total_disturbance_ha: number;
  total_disturbance_sqm: number;
  inside_disturbance_ha: number;
  inside_disturbance_sqm: number;
  outside_disturbance_ha: number;
  outside_disturbance_sqm: number;
  change_pct_of_lease: number;
  encroachment_pct: number;
  stockpile_change_ha: number;
  haul_roads_km: number;
  vegetation_loss_ha: number;
  water_change_ha: number;
  encroachment_alert: boolean;
}

export interface ProductionEstimates {
  excavation_area_sqm: number;
  excavation_area_ha: number;
  volume_m3?: number | null;
  volume_status: string;
  volume_note: string;
  in_situ_bulk_density_t_per_m3: number;
  excavated_mass_tonnes?: number | null;
  waste_fraction: number;
  estimated_waste_tonnes?: number | null;
  recovery_rate: number;
  estimated_saleable_production_tonnes?: number | null;
  disclaimer: string;
}

export interface CandidateFeature {
  id: string;
  db_id?: number;
  type: string;
  properties: {
    id: string;
    db_id?: number;
    category: string;
    feature_type: string;
    area_ha: number;
    area_sqm: number;
    confidence: number;
    color?: string;
    is_outside?: boolean;
    verification_status: 'CANDIDATE' | 'CONFIRMED' | 'REJECTED' | 'FIELD_VERIFY';
    inspector_notes?: string;
    verified_at?: string;
    description?: string;
    distance_m?: number;
  };
  geometry: any;
}

export interface ImportedLayer {
  id: number;
  lease_id?: string;
  layer_name: string;
  layer_type: 'KML' | 'KMZ' | 'GEOREFERENCED_IMAGE';
  acquisition_date?: string;
  source_description?: string;
  bounds?: [[number, number], [number, number]];
  geojson?: any;
  image_url?: string;
  created_at?: string;
}

export interface AnalysisResult {
  analysis_id: string;
  lease_id: string;
  lease_info: Partial<Lease>;
  satellite_metadata: SatelliteMetadata;
  metrics: AnalysisMetrics;
  production_estimates: ProductionEstimates;
  features: {
    inside: any[];
    outside: any[];
    candidate_excavation?: any[];
    boundary_encroachment?: any[];
    candidate_benches?: any[];
    stockpiles?: any[];
    haul_roads?: any[];
    vegetation_loss?: any[];
    all_features?: CandidateFeature[];
  };
  imagery_previews: {
    rgb_before_b64: string;
    rgb_after_b64: string;
    rgb_overlay_b64: string;
    bounds: [[number, number], [number, number]];
  };
  report_pdf_url: string;
  kml_url: string;
  created_at: string;
}

export interface DashboardStats {
  registered_leases: number;
  leases_analysed: number;
  total_detected_disturbance_ha: number;
  total_outside_excavation_ha: number;
  vegetation_cover_loss_ha: number;
  stockpile_changes_ha: number;
  encroachment_alerts_count: number;
  pending_field_verifications: number;
  is_demo_data: boolean;
}

export interface MineralProperty {
  id: number;
  mineral_name: string;
  in_situ_bulk_density: number;
  loose_bulk_density: number;
  particle_density: number;
  unit: string;
  source_reference: string;
  source_url: string;
}
