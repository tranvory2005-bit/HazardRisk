/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';

// --- Types ---
export interface FloodZoneResult {
  zone: string;
  subtype: string;
  bfe: number | null;
  source?: string;
}

export interface SinkholePoint {
  id: string;
  lat: number;
  lon: number;
  distanceMiles: number;
  bearing: string;
  date?: string;
  depthFt?: number | null;
  widthFt?: number | null;
  verified?: string;
  damage?: string;
  comments?: string;
  source: string;
}

export interface KarstBedrockInfo {
  unitName: string;
  karstType: string;
  rockType: string;
  exposure: string;
  climate?: string;
  formationAge?: string;
  isSoluble: boolean;
  source: string;
}

export interface SinkholeAssessment {
  tier: number; // 1 to 5
  tierLabel: string;
  tag: 'low' | 'mod' | 'high';
  closestSinkhole: SinkholePoint | null;
  pointsWithin1Mi: number;
  pointsWithin3Mi: number;
  pointsWithin5Mi: number;
  allPoints: SinkholePoint[];
  underlyingBedrock: KarstBedrockInfo | null;
  geologyPolygons: any[];
  flVulnerability?: { label: string; score: number } | null;
  summaryExplanation: string;
  sourceDescription: string;
}

export interface NriHazard {
  ratingLabel: string;
  tier: number | null;
  annualFreq: number | null;
}

export interface ReportData {
  addressRaw: string;
  displayName: string;
  lat: number;
  lon: number;
  stateAbbr: string;
  county: string;
  flood: FloodZoneResult | null;
  floodErr: boolean;
  zoneKey: string;
  zoneInfo: { name: string; risk: number; tag: 'low' | 'mod' | 'high' | 'unk'; desc: string };
  disasters: any[];
  disasterErr: boolean;
  windTier: number;
  windDistanceMiles: number;
  homeValue: number;
  mitigated: boolean;
  deductiblePct: number;
  includeFlood: boolean;
  wildfire: NriHazard | null;
  wildfireErr: boolean;
  earthquake: NriHazard | null;
  earthquakeErr: boolean;
  tornado: NriHazard | null;
  tornadoErr: boolean;
  sinkhole: SinkholeAssessment;
  sinkholeErr: boolean;
  epa: { general: any[]; generalOk: boolean; superfund: any[] } | null;
  epaErr: boolean;
  generatedAt: Date;
  mapBasemapDataUrl?: string;
  mapZoneFeatures?: any[];
  sinkholeBasemapDataUrl?: string;
}

// Reference coastline points along Gulf and Atlantic
const COASTLINE_POINTS: [number, number][] = [
  [25.9017, -97.4975], [27.8006, -97.3964], [27.8339, -97.0614], [29.3013, -94.7977],
  [29.3838, -94.9027], [29.885, -93.94], [30.2266, -93.2174], [29.9511, -90.0715],
  [29.2352, -89.9873], [30.3674, -89.0928], [30.6954, -88.0399], [30.4213, -87.2169],
  [30.1588, -85.6602], [29.7255, -84.9827], [29.1383, -83.0334], [27.9506, -82.4572],
  [27.3364, -82.5307], [26.6406, -81.8723], [26.142, -81.7948], [24.5551, -81.78],
  [25.7617, -80.1918], [26.1224, -80.1373], [26.7153, -80.0534], [27.6386, -80.3973],
  [28.3922, -80.6077], [29.2108, -81.0228], [29.9012, -81.3124], [30.3322, -81.6557],
  [31.1499, -81.4915], [32.0809, -81.0912], [32.2163, -80.7526], [32.7765, -79.9311],
  [33.6891, -78.8867], [34.2257, -77.9447], [34.7229, -76.726], [35.2199, -75.6288],
  [36.8529, -75.978], [38.3365, -75.0849], [39.3643, -74.4229], [38.9351, -74.906],
  [41.0362, -71.9518], [40.7128, -74.006], [41.3083, -72.9279], [41.824, -71.4128],
  [42.0526, -70.1786], [42.3601, -71.0589], [43.0718, -70.7626], [43.6591, -70.2568],
  [44.3876, -68.2039], [18.4655, -66.1057], [18.3419, -64.9307]
];

const STATE_WIND_TIER: Record<string, number> = {
  FL: 5, LA: 5, TX: 4, MS: 4, AL: 4, SC: 4, NC: 4, GA: 4, PR: 5, VI: 5,
  VA: 3, MD: 3, DE: 3, NJ: 3, NY: 3, CT: 2, RI: 2, MA: 2, NH: 2, ME: 2,
  DEFAULT: 1
};

const FLOOD_ZONE_INFO: Record<string, { name: string; risk: number; tag: 'low' | 'mod' | 'high' | 'unk'; desc: string }> = {
  VE: { name: 'Coastal high-hazard area (VE)', risk: 5, tag: 'high', desc: 'High-risk coastal zone subject to storm-induced velocity wave action in addition to flooding. Federal flood insurance is effectively mandatory for federally backed mortgages here.' },
  V: { name: 'Coastal high-hazard area (V)', risk: 5, tag: 'high', desc: 'High-risk coastal zone subject to wave action; base flood elevations may not yet be determined.' },
  AE: { name: 'High-risk flood area (AE)', risk: 4, tag: 'high', desc: '1% annual chance ("100-year") flood zone with base flood elevations determined. Flood insurance is typically required for federally backed mortgages.' },
  A: { name: 'High-risk flood area (A)', risk: 4, tag: 'high', desc: '1% annual chance flood zone; base flood elevations have not been determined by detailed study.' },
  AO: { name: 'High-risk shallow flooding area (AO)', risk: 4, tag: 'high', desc: 'High-risk area subject to shallow sheet-flow flooding, typically 1–3 feet deep.' },
  AH: { name: 'High-risk shallow flooding area (AH)', risk: 4, tag: 'high', desc: 'High-risk area subject to shallow ponding, typically 1–3 feet deep.' },
  AR: { name: 'Moderate/high-risk area, levee (AR)', risk: 3, tag: 'mod', desc: 'Area protected by a flood control system (e.g. a levee) being restored; risk sits between standard high- and moderate-risk zones.' },
  A99: { name: 'High-risk area, protected (A99)', risk: 3, tag: 'mod', desc: 'Area protected by a federal flood control system under construction.' },
  X500: { name: 'Moderate-risk area (Shaded X / 0.2%)', risk: 2, tag: 'mod', desc: '0.2% annual chance ("500-year") flood zone. Flood insurance is not federally required but is often worthwhile.' },
  X: { name: 'Minimal-risk area (X)', risk: 1, tag: 'low', desc: 'Area outside the 1% and 0.2% annual chance floodplains. Lowest FEMA-mapped flood risk category, though local drainage risk can still exist.' },
  D: { name: 'Undetermined risk area (D)', risk: 3, tag: 'unk', desc: 'Flood risk has not been studied or determined for this area. An elevation certificate or local floodplain study is recommended.' }
};

let currentReport: ReportData | null = null;
let floodManuallySet = false;
let sinkholeMapZoomMiles = 2.0; // Current zoom buffer in miles
let sinkholeMapType = 'satellite'; // 'satellite' | 'topo'

// --- Utility Math & Distance ---
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(brng / 22.5) % 16];
}

function distanceToCoastMiles(lat: number, lon: number): number {
  let min = Infinity;
  for (const [plat, plon] of COASTLINE_POINTS) {
    const d = haversineMiles(lat, lon, plat, plon);
    if (d < min) min = d;
  }
  return Math.round(min);
}

async function fetchWithTimeout(url: string, opts?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchBlobWithRetry(url: string): Promise<Blob> {
  try {
    const res = await fetchWithTimeout(url, undefined, 7000);
    if (!res.ok) throw new Error('export-http-' + res.status);
    return await res.blob();
  } catch {
    const res2 = await fetchWithTimeout(url, undefined, 9000);
    if (!res2.ok) throw new Error('export-http-' + res2.status);
    return await res2.blob();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function lonLatToWebMercator(lon: number, lat: number): [number, number] {
  const x = (lon * 20037508.34) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * 20037508.34) / 180;
  return [x, y];
}

function worldImageryUrl(lat: number, lon: number, buf: number, w: number, h: number): string {
  const bbox = [lon - buf, lat - buf, lon + buf, lat + buf].join(',');
  return (
    'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export' +
    '?bbox=' + bbox + '&bboxSR=4326&imageSR=4326&size=' + w + ',' + h + '&format=png32&f=image'
  );
}

function worldTopoUrl(lat: number, lon: number, buf: number, w: number, h: number): string {
  const bbox = [lon - buf, lat - buf, lon + buf, lat + buf].join(',');
  return (
    'https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/export' +
    '?bbox=' + bbox + '&bboxSR=4326&imageSR=4326&size=' + w + ',' + h + '&format=png32&f=image'
  );
}

// --- Geocoding ---
async function geocode(address: string) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=us&q=' +
    encodeURIComponent(address);
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 9000);
  if (!res.ok) throw new Error('geocode-http-' + res.status);
  const data = await res.json();
  if (!data || !data.length) throw new Error('geocode-empty');
  return data[0];
}

// --- Flood Zone Lookup ---
async function getFloodZoneFallback(lat: number, lon: number): Promise<FloodZoneResult | null> {
  const url =
    'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=*&returnGeometry=false&f=json';
  const res = await fetchWithTimeout(url, undefined, 8000);
  if (!res.ok) throw new Error('living-atlas-http-' + res.status);
  const data = await res.json();
  if (!data.features || !data.features.length) return null;
  const attrs = data.features[0].attributes || {};
  const find = (candidates: string[]) => {
    const key = Object.keys(attrs).find(k => candidates.includes(k.toLowerCase()));
    return key ? attrs[key] : undefined;
  };
  const zone = find(['fld_zone']);
  const bfeRaw = find(['static_bfe']);
  return {
    zone: zone || 'D',
    subtype: find(['zone_subty']) || '',
    bfe: typeof bfeRaw === 'number' && bfeRaw > -9000 ? bfeRaw : null,
    source: 'living-atlas'
  };
}

async function getFloodZone(lat: number, lon: number): Promise<FloodZoneResult | null> {
  const url =
    'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=FLD_ZONE,ZONE_SUBTY,STATIC_BFE&returnGeometry=false&f=json';
  try {
    const res = await fetchWithTimeout(url, undefined, 8000);
    if (!res.ok) throw new Error('fema-http-' + res.status);
    const data = await res.json();
    if (!data.features || !data.features.length) return null;
    const attrs = data.features[0].attributes;
    return {
      zone: attrs.FLD_ZONE || 'D',
      subtype: attrs.ZONE_SUBTY || '',
      bfe: typeof attrs.STATIC_BFE === 'number' && attrs.STATIC_BFE > -9000 ? attrs.STATIC_BFE : null
    };
  } catch (primaryErr) {
    return await getFloodZoneFallback(lat, lon);
  }
}

async function fetchZoneFeatures(lat: number, lon: number, buf: number): Promise<any[]> {
  const bbox = [lon - buf, lat - buf, lon + buf, lat + buf].join(',');
  const url =
    'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query' +
    '?geometry=' + bbox +
    '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=true&outSR=4326&f=json';
  const res = await fetchWithTimeout(url, undefined, 8000);
  if (!res.ok) throw new Error('living-atlas-geom-http-' + res.status);
  const data = await res.json();
  return data.features || [];
}

// =========================================================================
// LOCATION-LEVEL SINKHOLE & KARST RISK ENGINE
// =========================================================================

/**
 * Queries USGS National Karst layer for exact bedrock under the property point.
 */
async function getUnderlyingKarst(lat: number, lon: number): Promise<KarstBedrockInfo | null> {
  // Layer 14: Carbonates (Limestone, Dolomite, Chalk)
  const carbonateUrl =
    'https://services3.arcgis.com/C5aIa0c3gUMji8fg/arcgis/rest/services/Karst__USGS/FeatureServer/14/query' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=UNIT_NAME,KARST_TYPE,ROCKTYPE1,Exposure,Climate,Induration,UNIT_AGE&returnGeometry=false&f=json';
  try {
    const res = await fetchWithTimeout(carbonateUrl, undefined, 8000);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length) {
        const a = data.features[0].attributes;
        return {
          unitName: a.UNIT_NAME || 'Carbonate Rock Formation',
          karstType: a.KARST_TYPE || 'Soluble Carbonate Karst',
          rockType: a.ROCKTYPE1 || 'limestone',
          exposure: a.Exposure || 'E',
          climate: a.Climate || '',
          formationAge: a.UNIT_AGE || '',
          isSoluble: true,
          source: 'USGS National Karst (Carbonates)'
        };
      }
    }
  } catch (e) {
    console.warn('USGS Carbonates lookup skipped:', e);
  }

  // Layer 13: Evaporites (Gypsum, Anhydrite, Halite/Salt - highly soluble!)
  const evapUrl =
    'https://services3.arcgis.com/C5aIa0c3gUMji8fg/arcgis/rest/services/Karst__USGS/FeatureServer/13/query' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=UNIT_NAME,KARST_TYPE,ROCKTYPE1,Exposure,Climate,Induration,UNIT_AGE&returnGeometry=false&f=json';
  try {
    const res = await fetchWithTimeout(evapUrl, undefined, 8000);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length) {
        const a = data.features[0].attributes;
        return {
          unitName: a.UNIT_NAME || 'Evaporite Formation',
          karstType: a.KARST_TYPE || 'Soluble Evaporite Karst',
          rockType: a.ROCKTYPE1 || 'gypsum / evaporite',
          exposure: a.Exposure || 'E',
          climate: a.Climate || '',
          formationAge: a.UNIT_AGE || '',
          isSoluble: true,
          source: 'USGS National Karst (Evaporites)'
        };
      }
    }
  } catch (e) {
    console.warn('USGS Evaporites lookup skipped:', e);
  }

  // Layer 15: Sandstone Karst / Pseudokarst
  const sandUrl =
    'https://services3.arcgis.com/C5aIa0c3gUMji8fg/arcgis/rest/services/Karst__USGS/FeatureServer/15/query' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=UNIT_NAME,KARST_TYPE,ROCKTYPE1,Exposure,Climate,Induration,UNIT_AGE&returnGeometry=false&f=json';
  try {
    const res = await fetchWithTimeout(sandUrl, undefined, 8000);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length) {
        const a = data.features[0].attributes;
        return {
          unitName: a.UNIT_NAME || 'Sandstone Karst Formation',
          karstType: a.KARST_TYPE || 'Sandstone Karst / Piping',
          rockType: a.ROCKTYPE1 || 'sandstone',
          exposure: a.Exposure || 'E',
          climate: a.Climate || '',
          formationAge: a.UNIT_AGE || '',
          isSoluble: false,
          source: 'USGS National Karst (Sandstone)'
        };
      }
    }
  } catch (e) {
    console.warn('USGS Sandstone lookup skipped:', e);
  }

  return null;
}

/**
 * Fetches nearby USGS Karst polygons in the map viewport for overlay.
 */
async function fetchKarstPolygons(lat: number, lon: number, buf: number): Promise<any[]> {
  const bbox = [lon - buf, lat - buf, lon + buf, lat + buf].join(',');
  const url =
    'https://services3.arcgis.com/C5aIa0c3gUMji8fg/arcgis/rest/services/Karst__USGS/FeatureServer/14/query' +
    '?geometry=' + bbox +
    '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=UNIT_NAME,KARST_TYPE,ROCKTYPE1&returnGeometry=true&outSR=4326&resultRecordCount=50&f=json';
  try {
    const res = await fetchWithTimeout(url, undefined, 8000);
    if (!res.ok) return [];
    const data = await res.json();
    return data.features || [];
  } catch {
    return [];
  }
}

/**
 * Fetches real, documented sinkhole incidents from high-resolution state datasets
 * (Florida FGS, Pennsylvania DCNR, Kentucky LiDAR) with exact coordinates.
 */
async function fetchSinkholeIncidents(lat: number, lon: number, stateAbbr: string): Promise<SinkholePoint[]> {
  const points: SinkholePoint[] = [];

  // Florida: Florida Geological Survey (FGS / FDEP) Subsidence Incident Reports
  if (stateAbbr === 'FL') {
    try {
      const url =
        'https://ca.dep.state.fl.us/arcgis/rest/services/OpenData/FGS_SUBSIDENCE/MapServer/0/query' +
        '?geometry=' + lon + ',' + lat +
        '&geometryType=esriGeometryPoint&inSR=4326&distance=6&units=esriSRUnit_StatuteMile' +
        '&outFields=REF_NUM,COUNTY,EVENT_DATE,SINDEPTH,SINWIDTH,TRUE_SINK,PROPDAM,COMMENTS,ACCESS_' +
        '&returnGeometry=true&outSR=4326&resultRecordCount=120&f=json';
      const res = await fetchWithTimeout(url, undefined, 9000);
      if (res.ok) {
        const data = await res.json();
        for (const f of data.features || []) {
          const geom = f.geometry;
          if (!geom || typeof geom.x !== 'number' || typeof geom.y !== 'number') continue;
          const ptLon = geom.x, ptLat = geom.y;
          const dist = haversineMiles(lat, lon, ptLat, ptLon);
          if (dist > 5.5) continue;
          const a = f.attributes || {};
          let dateStr = '';
          if (a.EVENT_DATE) {
            try {
              dateStr = new Date(a.EVENT_DATE).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            } catch {}
          }
          points.push({
            id: a.REF_NUM || 'FGS-' + (points.length + 1),
            lat: ptLat,
            lon: ptLon,
            distanceMiles: Math.round(dist * 100) / 100,
            bearing: getBearing(lat, lon, ptLat, ptLon),
            date: dateStr,
            depthFt: typeof a.SINDEPTH === 'number' && a.SINDEPTH > 0 ? a.SINDEPTH : null,
            widthFt: typeof a.SINWIDTH === 'number' && a.SINWIDTH > 0 ? a.SINWIDTH : null,
            verified: a.TRUE_SINK === 'Y' ? 'Verified' : a.TRUE_SINK === 'N' ? 'Unverified/Other' : 'Reported',
            damage: a.PROPDAM === 'Y' ? 'Property damage reported' : a.PROPDAM === 'N' ? 'No damage reported' : 'Unknown',
            comments: (a.COMMENTS || a.ACCESS_ || '').trim(),
            source: 'Florida Geological Survey'
          });
        }
      }
    } catch (e) {
      console.warn('Florida sinkhole incident search error:', e);
    }
  }

  // Pennsylvania: DCNR PAKarst inventory
  if (stateAbbr === 'PA') {
    try {
      const buf = 0.08;
      const url =
        'https://mapservices.pasda.psu.edu/server/rest/services/pasda/DCNR2/MapServer/0/query' +
        '?geometry=' + (lon - buf) + ',' + (lat - buf) + ',' + (lon + buf) + ',' + (lat + buf) +
        '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
        '&outFields=LAT_DD,LONG_DD,KARST_TYPE&returnGeometry=true&outSR=4326&resultRecordCount=100&f=json';
      const res = await fetchWithTimeout(url, undefined, 8000);
      if (res.ok) {
        const data = await res.json();
        for (const f of data.features || []) {
          const a = f.attributes || {};
          const ptLat = a.LAT_DD || (f.geometry && f.geometry.y);
          const ptLon = a.LONG_DD || (f.geometry && f.geometry.x);
          if (!ptLat || !ptLon) continue;
          const dist = haversineMiles(lat, lon, ptLat, ptLon);
          if (dist > 5.5) continue;
          points.push({
            id: 'PA-DCNR-' + (points.length + 1),
            lat: ptLat,
            lon: ptLon,
            distanceMiles: Math.round(dist * 100) / 100,
            bearing: getBearing(lat, lon, ptLat, ptLon),
            comments: a.KARST_TYPE || 'Mapped karst depression / sinkhole',
            source: 'Pennsylvania DCNR Geological Survey'
          });
        }
      }
    } catch (e) {
      console.warn('PA DCNR sinkholes search error:', e);
    }
  }

  // Kentucky: KGS LiDAR Sinkholes
  if (stateAbbr === 'KY') {
    try {
      const buf = 0.08;
      const url =
        'https://kgs.uky.edu/arcgis/rest/services/KYWater/LiDAR_Sinkholes/MapServer/0/query' +
        '?geometry=' + (lon - buf) + ',' + (lat - buf) + ',' + (lon + buf) + ',' + (lat + buf) +
        '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
        '&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=100&f=json';
      const res = await fetchWithTimeout(url, undefined, 8000);
      if (res.ok) {
        const data = await res.json();
        for (const f of data.features || []) {
          const geom = f.geometry;
          if (!geom) continue;
          const ptLat = geom.y || geom.latitude;
          const ptLon = geom.x || geom.longitude;
          if (!ptLat || !ptLon) continue;
          const dist = haversineMiles(lat, lon, ptLat, ptLon);
          if (dist > 5.5) continue;
          points.push({
            id: 'KY-KGS-' + (points.length + 1),
            lat: ptLat,
            lon: ptLon,
            distanceMiles: Math.round(dist * 100) / 100,
            bearing: getBearing(lat, lon, ptLat, ptLon),
            comments: 'LiDAR-identified sinkhole depression',
            source: 'Kentucky Geological Survey'
          });
        }
      }
    } catch (e) {
      console.warn('Kentucky LiDAR sinkholes search error:', e);
    }
  }

  // Sort by distance ascending
  points.sort((a, b) => a.distanceMiles - b.distanceMiles);
  return points;
}

/**
 * Queries Florida GeoPlan Center's per-point geologic model if in Florida.
 */
async function getFloridaVulnerability(lat: number, lon: number): Promise<{ label: string; score: number } | null> {
  const buf = 0.002;
  const mapExtent = [lon - buf, lat - buf, lon + buf, lat + buf].join(',');
  const url =
    'https://leo.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Resilience/MapServer/identify' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&sr=4326' +
    '&layers=all:26&tolerance=2&mapExtent=' + mapExtent +
    '&imageDisplay=300,300,96&returnGeometry=false&f=json';
  try {
    const res = await fetchWithTimeout(url, undefined, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || !data.results.length) return null;
    const rawValue = parseInt(data.results[0].attributes?.Value ?? data.results[0].value, 10);
    if (!rawValue || rawValue < 1 || rawValue > 4) return null;
    const labels = [
      'Least favorable geology for sinkhole formation',
      'Less favorable geology for sinkhole formation',
      'More favorable geology for sinkhole formation',
      'Most favorable geology for sinkhole formation'
    ];
    return { label: labels[rawValue - 1], score: rawValue };
  } catch {
    return null;
  }
}

/**
 * Evaluates LOCATION-LEVEL sinkhole risk tied directly to coordinates.
 */
async function evaluateLocationSinkholeRisk(
  lat: number,
  lon: number,
  stateAbbr: string
): Promise<SinkholeAssessment> {
  const [underlyingBedrock, allPoints, flVulnerability, geologyPolygons] = await Promise.all([
    getUnderlyingKarst(lat, lon),
    fetchSinkholeIncidents(lat, lon, stateAbbr),
    stateAbbr === 'FL' ? getFloridaVulnerability(lat, lon) : Promise.resolve(null),
    fetchKarstPolygons(lat, lon, 0.04)
  ]);

  const closest = allPoints.length ? allPoints[0] : null;
  const pointsWithin1Mi = allPoints.filter(p => p.distanceMiles <= 1.0).length;
  const pointsWithin3Mi = allPoints.filter(p => p.distanceMiles <= 3.0).length;
  const pointsWithin5Mi = allPoints.length;

  const isSoluble = !!(underlyingBedrock && underlyingBedrock.isSoluble);
  const isExposed = underlyingBedrock?.exposure === 'E';
  const flScore = flVulnerability?.score ?? 0;

  // Compute location-level tier (1 to 5)
  let tier = 1;
  if (closest && closest.distanceMiles <= 0.35) {
    // Immediate sinkhole collapse within 1,800 feet
    tier = 5;
  } else if (
    (closest && closest.distanceMiles <= 0.75) ||
    pointsWithin1Mi >= 3 ||
    (pointsWithin3Mi >= 8 && isSoluble) ||
    (flScore === 4 && pointsWithin1Mi >= 1)
  ) {
    tier = 5;
  } else if (
    (closest && closest.distanceMiles <= 1.5) ||
    pointsWithin1Mi >= 1 ||
    (pointsWithin3Mi >= 3 && isSoluble) ||
    (flScore === 4 && isSoluble) ||
    (flScore === 3 && pointsWithin1Mi >= 1)
  ) {
    tier = 4;
  } else if (
    (closest && closest.distanceMiles <= 3.0) ||
    (isSoluble && isExposed) ||
    flScore === 3 ||
    (pointsWithin5Mi >= 3 && isSoluble)
  ) {
    tier = 3;
  } else if (
    (closest && closest.distanceMiles <= 5.0) ||
    isSoluble ||
    flScore === 2 ||
    geologyPolygons.length > 0
  ) {
    tier = 2;
  } else {
    // Non-karst rock, no sinkholes recorded within 5 miles
    tier = 1;
  }

  const tierLabels = [
    '',
    'Very Low Local Risk',
    'Low-Moderate Local Risk',
    'Moderate Local Risk',
    'High Local Risk',
    'Very High Local Risk'
  ];
  const tags: ('low' | 'mod' | 'high')[] = ['low', 'low', 'low', 'mod', 'high', 'high'];

  // Craft dynamic explanation based on real findings
  const explanationParts: string[] = [];

  if (underlyingBedrock) {
    explanationParts.push(
      `Property is underlain by the <strong>${escapeHtml(underlyingBedrock.unitName)}</strong> (${escapeHtml(underlyingBedrock.rockType)}${underlyingBedrock.exposure === 'E' ? ', exposed/shallow bedrock' : ', mantled/buried'}).`
    );
  } else {
    explanationParts.push('No soluble carbonate or evaporite bedrock formation is mapped directly beneath this parcel.');
  }

  if (allPoints.length > 0) {
    explanationParts.push(
      `<strong>${allPoints.length} documented sinkhole/subsidence incident${allPoints.length === 1 ? '' : 's'}</strong> found within 5 miles (${pointsWithin1Mi} within 1 mile; ${pointsWithin3Mi} within 3 miles). The nearest recorded incident is <strong>${closest!.distanceMiles} miles ${closest!.bearing}</strong>.`
    );
  } else {
    explanationParts.push('Zero documented sinkhole collapse incidents on public geological survey records within 5 miles.');
  }

  if (flVulnerability) {
    explanationParts.push(
      `Florida Geological Survey subsurface vulnerability model rates this specific parcel as <em>"${flVulnerability.label.toLowerCase()}"</em>.`
    );
  }

  const sourceDescription =
    (stateAbbr === 'FL'
      ? 'Source: Florida Geological Survey (FGS / FDEP) Subsidence Incident Reports database + Florida GeoPlan Center sinkhole vulnerability model + USGS National Karst Geologic Units layer.'
      : stateAbbr === 'PA'
      ? 'Source: Pennsylvania DCNR Geological Survey Karst Features Inventory + USGS National Karst Geologic Units layer.'
      : stateAbbr === 'KY'
      ? 'Source: Kentucky Geological Survey (KGS) LiDAR Sinkhole Inventory + USGS National Karst Geologic Units layer.'
      : 'Source: USGS National Karst & Soluble Bedrock Geologic Units layer (Open-File Report 2014-1156, contiguous U.S.).') +
    ' Site-specific assessment computed from exact parcel coordinates.';

  return {
    tier,
    tierLabel: tierLabels[tier],
    tag: tags[tier],
    closestSinkhole: closest,
    pointsWithin1Mi,
    pointsWithin3Mi,
    pointsWithin5Mi,
    allPoints,
    underlyingBedrock,
    geologyPolygons,
    flVulnerability,
    summaryExplanation: explanationParts.join(' '),
    sourceDescription
  };
}

// --- Disaster History ---
function normalizeArea(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(county|parish|borough|census area|municipality|independent city|city and borough)\b/g, ' ')
    .replace(/[^a-z]/g, '');
}

async function getDisasterHistory(stateAbbr: string, countyName: string): Promise<any[]> {
  if (!stateAbbr) return [];
  const filter = encodeURIComponent("state eq '" + stateAbbr + "' and fyDeclared ge 2000");
  const url =
    'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries' +
    '?$filter=' + filter +
    '&$select=disasterNumber,declarationDate,incidentType,declarationTitle,designatedArea,fyDeclared' +
    '&$orderby=declarationDate desc&$top=2000';
  const res = await fetchWithTimeout(url, undefined, 8000);
  if (!res.ok) throw new Error('openfema-http-' + res.status);
  const data = await res.json();
  const rows = data.DisasterDeclarationsSummaries || [];
  const countyNorm = normalizeArea(countyName);
  const seen = new Set<string>();
  const filtered: any[] = [];
  for (const r of rows) {
    const areaNorm = normalizeArea(r.designatedArea);
    if (countyNorm && areaNorm !== countyNorm && r.designatedArea !== 'Statewide') continue;
    const key = r.disasterNumber + '-' + r.incidentType;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(r);
  }
  filtered.sort((a, b) => new Date(b.declarationDate).getTime() - new Date(a.declarationDate).getTime());
  return filtered.slice(0, 12);
}

// --- FEMA National Risk Index (NRI) Hazards ---
const NRI_TIER_MAP: Record<string, number> = {
  'very low': 1,
  'relatively low': 2,
  'relatively moderate': 3,
  'relatively high': 4,
  'very high': 5
};

function parseNriHazard(attrs: any, prefix: string): NriHazard {
  const ratingRaw = (attrs[prefix + '_RISKR'] || '').toString().trim();
  return {
    ratingLabel: ratingRaw || 'Not rated',
    tier: NRI_TIER_MAP[ratingRaw.toLowerCase()] || null,
    annualFreq: typeof attrs[prefix + '_AFREQ'] === 'number' ? attrs[prefix + '_AFREQ'] : null
  };
}

async function getNriHazards(lat: number, lon: number): Promise<{ wildfire: NriHazard; earthquake: NriHazard; tornado: NriHazard } | null> {
  const url =
    'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects' +
    '&outFields=WFIR_RISKR,WFIR_AFREQ,ERQK_RISKR,ERQK_AFREQ,TRND_RISKR,TRND_AFREQ&returnGeometry=false&f=json';
  const res = await fetchWithTimeout(url, undefined, 8000);
  if (!res.ok) throw new Error('nri-http-' + res.status);
  const data = await res.json();
  if (!data.features || !data.features.length) return null;
  const attrs = data.features[0].attributes || {};
  return {
    wildfire: parseNriHazard(attrs, 'WFIR'),
    earthquake: parseNriHazard(attrs, 'ERQK'),
    tornado: parseNriHazard(attrs, 'TRND')
  };
}

// --- EPA Sites ---
async function getSuperfundSites(lat: number, lon: number, radiusMiles: number): Promise<any[]> {
  const url =
    'https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/' +
    'Superfund_National_Priorities_List_(NPL)_Sites_with_Status_Information/FeatureServer/0/query' +
    '?geometry=' + lon + ',' + lat +
    '&geometryType=esriGeometryPoint&inSR=4326' +
    '&distance=' + radiusMiles + '&units=esriSRUnit_StatuteMile&spatialRel=esriSpatialRelIntersects' +
    '&outFields=NAME,City,State,County,NPL_STATUS&returnGeometry=false&f=json';
  const res = await fetchWithTimeout(url, undefined, 8000);
  if (!res.ok) throw new Error('epa-npl-http-' + res.status);
  const data = await res.json();
  return (data.features || []).map((f: any) => f.attributes || {});
}

async function getGeneralEpaFacilitiesBestEffort(lat: number, lon: number): Promise<{ list: any[]; ok: boolean }> {
  try {
    const url =
      'https://ofmpub.epa.gov/frs_public2/frs_rest_services.get_facilities' +
      '?latitude83=' + lat + '&longitude83=' + lon + '&search_radius=1&output=JSON';
    const res = await fetchWithTimeout(url, undefined, 8000);
    if (!res.ok) throw new Error('epa-frs-http-' + res.status);
    const data = await res.json();
    let list: any[] = [];
    if (Array.isArray(data)) list = data;
    else if (data?.FRSFacility) list = data.FRSFacility;
    else if (data?.Results?.FRSFacility) list = data.Results.FRSFacility;
    return { list, ok: true };
  } catch {
    return { list: [], ok: false };
  }
}

async function getEpaFacilities(lat: number, lon: number) {
  const [superfund, generalResult] = await Promise.all([
    getSuperfundSites(lat, lon, 3),
    getGeneralEpaFacilitiesBestEffort(lat, lon)
  ]);
  return { general: generalResult.list, generalOk: generalResult.ok, superfund };
}

// --- Insurance & Wind Tier Helpers ---
function estimateWindTier(stateAbbr: string, lat: number, lon: number): { tier: number; distanceMiles: number } {
  const baseTier = STATE_WIND_TIER[stateAbbr] || STATE_WIND_TIER.DEFAULT;
  const distanceMiles = distanceToCoastMiles(lat, lon);
  if (baseTier <= 1) return { tier: 1, distanceMiles };
  let tier: number;
  if (distanceMiles <= 2) tier = 5;
  else if (distanceMiles <= 10) tier = Math.min(5, baseTier + 1);
  else if (distanceMiles <= 30) tier = baseTier;
  else if (distanceMiles <= 75) tier = Math.max(1, baseTier - 1);
  else tier = Math.max(1, baseTier - 2);
  return { tier, distanceMiles };
}

function tierMeta(tier: number): { name: string; tag: 'low' | 'mod' | 'high' } {
  const map: Record<number, { name: string; tag: 'low' | 'mod' | 'high' }> = {
    1: { name: 'Low exposure', tag: 'low' },
    2: { name: 'Low-moderate exposure', tag: 'low' },
    3: { name: 'Moderate exposure', tag: 'mod' },
    4: { name: 'High exposure', tag: 'mod' },
    5: { name: 'Very high exposure', tag: 'high' }
  };
  return map[tier] || map[1];
}

const HURRICANE_DEDUCTIBLE_MULTIPLIER: Record<number, number> = { 1: 1.12, 2: 1.0, 3: 0.94, 4: 0.89, 5: 0.85 };

function scoreToHomeRange(tier: number, scale: number, mitigated: boolean, deductiblePct: number): [number, number] {
  const table: Record<number, [number, number]> = {
    1: [1000, 2000],
    2: [1600, 2800],
    3: [2200, 4200],
    4: [3000, 6000],
    5: [4200, 10000]
  };
  const [lo, hi] = table[tier] || table[1];
  const mit = mitigated ? 0.75 : 1;
  const ded = HURRICANE_DEDUCTIBLE_MULTIPLIER[deductiblePct] || 1;
  return [lo * scale * mit * ded, hi * scale * mit * ded];
}

function scoreToFloodRange(floodRisk: number, scale: number): [number, number] {
  const table: Record<number, [number, number]> = {
    1: [250, 650],
    2: [400, 900],
    3: [600, 1500],
    4: [900, 2400],
    5: [1800, 5500]
  };
  const [lo, hi] = table[floodRisk] || table[1];
  return [lo * scale, hi * scale];
}

function disasterFrequencyBump(count: number): number {
  if (count >= 13) return 1.15;
  if (count >= 7) return 1.08;
  return 1.0;
}

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
}

function stateNameToAbbr(name: string): string {
  const M: Record<string, string> = {
    Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'Puerto Rico': 'PR'
  };
  return M[name] || '';
}

function normalizeZoneKey(zone: string, subtype: string): string {
  if (!zone) return 'D';
  const z = zone.toUpperCase().trim();
  if (z === 'X' && subtype && subtype.toUpperCase().includes('0.2')) return 'X500';
  if (FLOOD_ZONE_INFO[z]) return z;
  if (z.startsWith('V')) return 'VE';
  if (z.startsWith('A')) return 'AE';
  return 'D';
}

function setStatus(msg: string, isErr = false) {
  const el = document.getElementById('status-line');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('err', isErr);
}

function parseHomeValue(): number {
  const input = document.getElementById('home-value') as HTMLInputElement | null;
  const raw = (input?.value || '').replace(/[^0-9.]/g, '');
  const v = parseFloat(raw);
  if (!v || v <= 0) return 350000;
  return Math.min(Math.max(v, 60000), 5000000);
}

// =========================================================================
// MAP VISUALIZATION RENDERING
// =========================================================================

// Flood Vector Overlay
function buildFloodZoneSvg(features: any[], lat: number, lon: number, buf: number, w: number, h: number): string {
  const minLon = lon - buf, maxLon = lon + buf, minLat = lat - buf, maxLat = lat + buf;
  function toPx(px: number, py: number): [number, number] {
    const x = ((px - minLon) / (maxLon - minLon)) * w;
    const y = h - ((py - minLat) / (maxLat - minLat)) * h;
    return [x, y];
  }
  let shapes = '', labels = '';
  features.forEach(f => {
    const rings = f.geometry?.rings || [];
    const zone = f.attributes?.FLD_ZONE || '';
    const info = FLOOD_ZONE_INFO[normalizeZoneKey(zone, '')] || FLOOD_ZONE_INFO['D'];
    const color = { high: '#96382A', mod: '#AD6E28', low: '#3C6E52', unk: '#8b978d' }[info.tag] || '#8b978d';
    rings.forEach((ring: [number, number][]) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let sumX = 0, sumY = 0;
      const d =
        ring
          .map((pt, i) => {
            const [x, y] = toPx(pt[0], pt[1]);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            sumX += x; sumY += y;
            return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
          })
          .join(' ') + ' Z';
      shapes += '<path d="' + d + '" fill="' + color + '" fill-opacity="0.48" stroke="' + color + '" stroke-width="1.2"/>';
      if (zone && maxX - minX > 24 && maxY - minY > 16) {
        const cx = (sumX / ring.length).toFixed(1), cy = (sumY / ring.length).toFixed(1);
        labels +=
          '<text x="' + cx + '" y="' + cy + '" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600" fill="#182129" stroke="#F8F9F2" stroke-width="3" paint-order="stroke" text-anchor="middle" dominant-baseline="middle">' +
          zone +
          '</text>';
      }
    });
  });
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">' + shapes + labels + '</svg>';
}

function loadFloodMap(lat: number, lon: number, floodErr: boolean) {
  const basemap = document.getElementById('flood-map-basemap') as HTMLImageElement;
  const markerAerial = document.getElementById('flood-map-marker-aerial');
  const aerialPlaceholder = document.getElementById('flood-map-aerial-placeholder');
  const svgContainer = document.getElementById('flood-map-svg-container');
  const caption = document.getElementById('flood-map-caption');
  if (!basemap || !markerAerial || !aerialPlaceholder || !svgContainer || !caption) return;
  const captionEl = caption;

  basemap.style.display = 'none';
  markerAerial.style.display = 'none';
  svgContainer.style.display = 'none';
  aerialPlaceholder.style.display = 'flex';
  aerialPlaceholder.textContent = 'Loading map…';

  const [x, y] = lonLatToWebMercator(lon, lat);
  const femaViewerUrl = 'https://experience.arcgis.com/experience/9d22cdae8b7542b88e0d555a3eb92949#map_1=center:' + x + ',' + y + ',102100,level:16';
  const exploreLink = '<a href="' + femaViewerUrl + '" target="_blank" rel="noopener">Explore in FEMA\u2019s official NFHL viewer</a>.';
  const buf = 0.008;

  let basemapOk: boolean | null = null, zoneResult: string | null = null;
  function updateCaption() {
    if (basemapOk === null || zoneResult === null) return;
    const zoneOk = zoneResult !== 'failed';
    if (!basemapOk && !zoneOk) {
      captionEl.innerHTML = 'Map imagery could not be loaded on this network. ' + exploreLink;
      return;
    }
    const zoneDesc =
      zoneResult === 'vector'
        ? 'FEMA flood zone boundaries overlaid (Esri Living Atlas mirror)'
        : zoneResult === 'vector-empty'
        ? 'no mapped flood zone found in view'
        : 'overlay unavailable';
    captionEl.innerHTML = `Aerial imagery (Esri) with ${zoneDesc}. Crosshair pin marks parcel. ${exploreLink}`;
  }

  basemap.onload = () => {
    basemapOk = true;
    basemap.style.display = 'block';
    markerAerial.style.display = 'block';
    aerialPlaceholder.style.display = 'none';
    updateCaption();
  };
  basemap.onerror = () => {
    basemapOk = false;
    aerialPlaceholder.textContent = 'Map imagery could not be loaded.';
    updateCaption();
  };
  basemap.src = worldImageryUrl(lat, lon, buf, 700, 560);

  fetchZoneFeatures(lat, lon, buf)
    .then(features => {
      svgContainer.innerHTML = buildFloodZoneSvg(features, lat, lon, buf, 700, 560);
      svgContainer.style.display = 'block';
      zoneResult = features.length ? 'vector' : 'vector-empty';
      updateCaption();
    })
    .catch(() => {
      zoneResult = 'failed';
      updateCaption();
    });
}

// --- SINKHOLE MAP OVERLAY BUILDER ---
function buildSinkholeSvg(
  points: SinkholePoint[],
  polygons: any[],
  centerLat: number,
  centerLon: number,
  buf: number,
  w: number,
  h: number
): string {
  const minLon = centerLon - buf, maxLon = centerLon + buf;
  const minLat = centerLat - buf, maxLat = centerLat + buf;

  function toPx(px: number, py: number): [number, number] {
    const x = ((px - minLon) / (maxLon - minLon)) * w;
    const y = h - ((py - minLat) / (maxLat - minLat)) * h;
    return [x, y];
  }

  let svgElements = '';

  // 1. Karst Bedrock Polygons (USGS)
  if (polygons && polygons.length) {
    let polyPaths = '';
    polygons.forEach(f => {
      const rings = f.geometry?.rings || [];
      rings.forEach((ring: [number, number][]) => {
        const d = ring
          .map((pt, idx) => {
            const [x, y] = toPx(pt[0], pt[1]);
            return (idx === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
          })
          .join(' ') + ' Z';
        polyPaths += `<path d="${d}" fill="#AD6E28" fill-opacity="0.22" stroke="#AD6E28" stroke-width="1.2" stroke-dasharray="3,3" />`;
      });
    });
    svgElements += `<g class="karst-polygons">${polyPaths}</g>`;
  }

  // 2. Concentric Distance Range Rings from Target Property (0.5 mi, 1.0 mi, 3.0 mi)
  const [cx, cy] = toPx(centerLon, centerLat);
  const ringDistances = [0.5, 1.0, 3.0];
  const ringElements = ringDistances
    .map(distMi => {
      // Approximate pixel radius using haversine conversion to degrees
      const latDegreeOffset = distMi / 69.0;
      const [, ringPy] = toPx(centerLon, centerLat + latDegreeOffset);
      const rPx = Math.abs(cy - ringPy);
      if (rPx > w && rPx > h) return '';
      return `
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rPx.toFixed(1)}" fill="none" stroke="#EDF0E6" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="4,4" />
        <text x="${cx.toFixed(1)}" y="${(cy - rPx + 11).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" font-weight="500" fill="#F8F9F2" stroke="#182129" stroke-width="2" paint-order="stroke" text-anchor="middle">${distMi} mi</text>
      `;
    })
    .join('');
  svgElements += `<g class="range-rings">${ringElements}</g>`;

  // 3. Documented Sinkhole Incident Points
  const pointElements = points
    .map((pt, idx) => {
      const [px, py] = toPx(pt.lon, pt.lat);
      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) return '';
      const isVeryClose = pt.distanceMiles <= 1.0;
      const pinColor = isVeryClose ? '#DC2626' : '#D97706';
      const haloColor = isVeryClose ? '#EF4444' : '#F59E0B';
      const radius = isVeryClose ? 7.0 : 4.8;

      return `
        <g class="sinkhole-marker-node" data-idx="${idx}" style="cursor:pointer;" transform="translate(${px.toFixed(1)}, ${py.toFixed(1)})">
          <circle cx="0" cy="0" r="16" fill="transparent" class="sinkhole-hit-target" />
          <circle cx="0" cy="0" r="${(radius + 4).toFixed(1)}" fill="${haloColor}" fill-opacity="${isVeryClose ? '0.35' : '0.25'}" class="sinkhole-halo" />
          <circle cx="0" cy="0" r="${radius.toFixed(1)}" fill="${pinColor}" stroke="#FFFFFF" stroke-width="1.8" class="sinkhole-dot" />
          <circle cx="0" cy="0" r="${isVeryClose ? '2.0' : '1.3'}" fill="#FFFFFF" />
        </g>
      `;
    })
    .join('');
  svgElements += `<g class="sinkhole-points">${pointElements}</g>`;

  // 4. Target Parcel Location Marker in SVG (Vivid Royal Blue #1D4ED8)
  svgElements += `
    <g class="target-parcel-marker" pointer-events="none">
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="16" fill="#1D4ED8" fill-opacity="0.22" />
      <line x1="${(cx - 16).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx - 7).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round" />
      <line x1="${(cx + 7).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + 16).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round" />
      <line x1="${cx.toFixed(1)}" y1="${(cy - 16).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(cy - 7).toFixed(1)}" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round" />
      <line x1="${cx.toFixed(1)}" y1="${(cy + 7).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(cy + 16).toFixed(1)}" stroke="#1D4ED8" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="#1D4ED8" stroke="#FFFFFF" stroke-width="2.5" />
      <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.2" fill="#FFFFFF" />
    </g>
  `;

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${svgElements}</svg>`;
}

function loadSinkholeMap(lat: number, lon: number, report: ReportData) {
  const basemap = document.getElementById('sinkhole-map-basemap') as HTMLImageElement;
  const markerProperty = document.getElementById('sinkhole-map-marker-property');
  const placeholder = document.getElementById('sinkhole-map-placeholder');
  const svgContainer = document.getElementById('sinkhole-map-svg-container');
  const caption = document.getElementById('sinkhole-map-caption');
  const tooltip = document.getElementById('sinkhole-tooltip');

  if (!basemap || !markerProperty || !placeholder || !svgContainer || !caption) return;

  basemap.style.display = 'none';
  markerProperty.style.display = 'none';
  svgContainer.style.display = 'none';
  placeholder.style.display = 'flex';
  placeholder.textContent = 'Loading location-level sinkhole map…';

  // Convert buffer miles to approximate degree delta: 1 deg lat ≈ 69 miles
  const buf = (sinkholeMapZoomMiles / 69.0) * 1.15;

  basemap.onload = () => {
    basemap.style.display = 'block';
    markerProperty.style.display = 'block';
    placeholder.style.display = 'none';
    svgContainer.style.display = 'block';
  };
  basemap.onerror = () => {
    placeholder.textContent = 'Sinkhole map imagery could not be loaded.';
  };

  const mapUrl =
    sinkholeMapType === 'topo'
      ? worldTopoUrl(lat, lon, buf, 700, 560)
      : worldImageryUrl(lat, lon, buf, 700, 560);
  basemap.src = mapUrl;

  const points = report.sinkhole.allPoints;
  const polygons = report.sinkhole.geologyPolygons;
  svgContainer.innerHTML = buildSinkholeSvg(points, polygons, lat, lon, buf, 700, 560);

  let selectedSinkholeIdx: number | null = null;

  function showSinkholeTooltip(pt: SinkholePoint, idx: number, anchorX: number, anchorY: number, isStickyClick = false) {
    if (!tooltip || !svgContainer) return;
    const rect = svgContainer.getBoundingClientRect();

    if (isStickyClick) {
      selectedSinkholeIdx = idx;
    }

    // Highlight the selected marker on the map
    svgContainer.querySelectorAll('.sinkhole-marker-node').forEach(n => {
      const nodeIdx = parseInt((n as HTMLElement).getAttribute('data-idx') || '-1', 10);
      const halo = n.querySelector('.sinkhole-halo') as SVGElement | null;
      const dot = n.querySelector('.sinkhole-dot') as SVGElement | null;
      if (halo && dot) {
        if (nodeIdx === idx) {
          halo.setAttribute('fill', '#AD6E28');
          halo.setAttribute('fill-opacity', '0.65');
          halo.setAttribute('stroke', '#182129');
          halo.setAttribute('stroke-width', '1.8');
          dot.setAttribute('stroke', '#AD6E28');
        } else {
          const ptOther = points[nodeIdx];
          const isClose = ptOther ? ptOther.distanceMiles <= 1.0 : false;
          halo.setAttribute('fill', isClose ? '#EF4444' : '#F59E0B');
          halo.setAttribute('fill-opacity', isClose ? '0.35' : '0.25');
          halo.removeAttribute('stroke');
          halo.removeAttribute('stroke-width');
          dot.setAttribute('fill', isClose ? '#DC2626' : '#D97706');
          dot.setAttribute('stroke', '#FFFFFF');
        }
      }
    });

    let dimStr = '';
    if (pt.depthFt || pt.widthFt) {
      dimStr = `<div style="font-family:var(--mono);font-size:11.5px;color:var(--amber);margin-top:4px;">
        ${pt.depthFt ? 'Depth: ' + pt.depthFt + ' ft' : ''}
        ${pt.depthFt && pt.widthFt ? ' &bull; ' : ''}
        ${pt.widthFt ? 'Width: ' + pt.widthFt + ' ft' : ''}
      </div>`;
    }

    let damageStr = '';
    if (pt.damage && pt.damage !== 'Unknown') {
      const isDmg = pt.damage.toLowerCase().includes('damage reported');
      damageStr = `<div style="font-size:11.5px;margin-top:3px;color:${isDmg ? 'var(--risk-high)' : 'var(--risk-low)'};font-weight:500;">
        ${escapeHtml(pt.damage)}
      </div>`;
    }

    tooltip.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div>
          <div style="font-family:var(--mono);font-weight:600;font-size:13px;color:var(--ink);">
            ${escapeHtml(pt.id)}
          </div>
          <div style="font-family:var(--mono);font-size:11.5px;color:${pt.distanceMiles <= 1.0 ? '#DC2626' : '#D97706'};font-weight:600;margin-top:1px;">
            ${pt.distanceMiles} mi ${pt.bearing} of property
          </div>
        </div>
        <button class="tip-close-btn" onclick="window.hideSinkholeTooltip()" title="Close details">&times;</button>
      </div>

      ${pt.date ? `<div style="font-size:11.5px;color:var(--ink-soft);margin-bottom:2px;"><span style="color:var(--ink-faint);">Event Date:</span> ${escapeHtml(pt.date)}</div>` : ''}
      ${dimStr}
      ${damageStr}
      ${pt.verified ? `<div style="font-size:11px;color:var(--ink-soft);margin-top:2px;"><span style="color:var(--ink-faint);">Status:</span> ${escapeHtml(pt.verified)}</div>` : ''}

      ${pt.comments ? `
        <div style="font-size:11.5px;color:var(--ink);background:var(--paper);border-left:2px solid var(--amber);padding:5px 8px;margin:7px 0;line-height:1.4;max-height:85px;overflow-y:auto;">
          ${escapeHtml(pt.comments)}
        </div>
      ` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid var(--line-soft);">
        <button onclick="window.highlightSinkholeInList(${idx})" style="background:var(--ink);color:var(--paper-raised);border:none;font-family:var(--mono);font-size:10.5px;padding:3px 9px;cursor:pointer;border-radius:2px;">
          Highlight in table &darr;
        </button>
        <span style="font-size:9.5px;color:var(--ink-faint);">${escapeHtml(pt.source)}</span>
      </div>
    `;

    tooltip.style.display = 'block';

    const tipW = 280;
    const tipH = tooltip.offsetHeight || 190;

    let posX = anchorX + 16;
    if (posX + tipW > rect.width - 12) {
      posX = anchorX - tipW - 16;
    }
    if (posX < 8) posX = 8;

    let posY = anchorY - tipH / 2;
    if (posY < 8) posY = 8;
    if (posY + tipH > rect.height - 8) {
      posY = rect.height - tipH - 8;
    }

    tooltip.style.left = posX + 'px';
    tooltip.style.top = posY + 'px';
  }

  function hideSinkholeTooltip() {
    selectedSinkholeIdx = null;
    if (tooltip) tooltip.style.display = 'none';
    if (svgContainer) {
      svgContainer.querySelectorAll('.sinkhole-marker-node').forEach(n => {
        const nodeIdx = parseInt((n as HTMLElement).getAttribute('data-idx') || '-1', 10);
        const halo = n.querySelector('.sinkhole-halo') as SVGElement | null;
        const dot = n.querySelector('.sinkhole-dot') as SVGElement | null;
        if (halo && dot) {
          const ptOther = points[nodeIdx];
          const isClose = ptOther ? ptOther.distanceMiles <= 1.0 : false;
          halo.setAttribute('fill', isClose ? '#EF4444' : '#F59E0B');
          halo.setAttribute('fill-opacity', isClose ? '0.35' : '0.25');
          halo.removeAttribute('stroke');
          halo.removeAttribute('stroke-width');
          dot.setAttribute('fill', isClose ? '#DC2626' : '#D97706');
          dot.setAttribute('stroke', '#FFFFFF');
        }
      });
    }
  }

  (window as any).hideSinkholeTooltip = hideSinkholeTooltip;

  // Attach interactive click and hover handlers on sinkhole marker nodes
  const markerNodes = svgContainer.querySelectorAll('.sinkhole-marker-node');
  markerNodes.forEach(node => {
    // CLICK LISTENER: displays persistent detailed tooltip when user clicks a sinkhole icon
    node.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const mouseEvent = e as MouseEvent;
      const idx = parseInt((node as HTMLElement).getAttribute('data-idx') || '0', 10);
      const pt = points[idx];
      if (!pt) return;
      const rect = svgContainer.getBoundingClientRect();
      const tipX = mouseEvent.clientX - rect.left;
      const tipY = mouseEvent.clientY - rect.top;
      showSinkholeTooltip(pt, idx, tipX, tipY, true);
    });

    // Hover listener: preview details when not locked by a click
    node.addEventListener('mouseenter', (e: Event) => {
      if (selectedSinkholeIdx !== null) return;
      const mouseEvent = e as MouseEvent;
      const idx = parseInt((node as HTMLElement).getAttribute('data-idx') || '0', 10);
      const pt = points[idx];
      if (!pt) return;
      const rect = svgContainer.getBoundingClientRect();
      const tipX = mouseEvent.clientX - rect.left;
      const tipY = mouseEvent.clientY - rect.top;
      showSinkholeTooltip(pt, idx, tipX, tipY, false);
    });

    node.addEventListener('mouseleave', () => {
      if (selectedSinkholeIdx === null && tooltip) {
        tooltip.style.display = 'none';
      }
    });
  });

  // Clicking on map outside sinkhole nodes dismisses any active tooltip
  const mapBox = document.getElementById('sinkhole-map-box');
  if (mapBox) {
    mapBox.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement | SVGElement;
      if (!target.closest('.sinkhole-marker-node') && !target.closest('#sinkhole-tooltip')) {
        hideSinkholeTooltip();
      }
    });
  }

  const countInView = points.filter(p => p.distanceMiles <= sinkholeMapZoomMiles).length;
  caption.innerHTML = `
    Showing <strong>${countInView}</strong> documented sinkhole/subsidence feature${countInView === 1 ? '' : 's'} within ${sinkholeMapZoomMiles} miles.
    <strong>Click any sinkhole icon</strong> to inspect event details, dimensions, and damage reports.
  `;
}

function highlightSinkholeInList(idx: number) {
  const row = document.getElementById('sinkhole-row-' + idx);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.backgroundColor = '#F0E1C8';
    setTimeout(() => {
      row.style.backgroundColor = '';
    }, 2500);
  }
}

export function selectSinkholeFromTable(idx: number) {
  if (!currentReport) return;
  const points = currentReport.sinkhole.allPoints;
  const pt = points[idx];
  if (!pt) return;

  const mapBox = document.getElementById('sinkhole-map-box');
  if (mapBox) {
    mapBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const svgContainer = document.getElementById('sinkhole-map-svg-container');
  if (!svgContainer) return;

  const node = svgContainer.querySelector(`.sinkhole-marker-node[data-idx="${idx}"]`) as HTMLElement | null;
  if (node) {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  } else {
    // If not within current zoom extent, expand to 5 miles to reveal the marker
    setSinkholeZoom(5.0);
    setTimeout(() => {
      const containerAfter = document.getElementById('sinkhole-map-svg-container');
      const nodeAfter = containerAfter?.querySelector(`.sinkhole-marker-node[data-idx="${idx}"]`) as HTMLElement | null;
      if (nodeAfter) {
        nodeAfter.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    }, 450);
  }

  highlightSinkholeInList(idx);
}

// Prefetch for PDF
const PDF_MAP_BUF = 0.008;

async function prefetchPdfMapImage(report: ReportData) {
  // 1. Flood map prefetch
  const [basemapResult, zoneResult] = await Promise.allSettled([
    fetchBlobWithRetry(worldImageryUrl(report.lat, report.lon, PDF_MAP_BUF, 640, 480)).then(blobToDataUrl),
    fetchZoneFeatures(report.lat, report.lon, PDF_MAP_BUF)
  ]);
  if (currentReport !== report) return;
  if (basemapResult.status === 'fulfilled') report.mapBasemapDataUrl = basemapResult.value;
  if (zoneResult.status === 'fulfilled') report.mapZoneFeatures = zoneResult.value;

  // 2. Sinkhole map prefetch (using 2-mile buffer)
  const sinkholeBuf = (2.0 / 69.0) * 1.15;
  try {
    const sinkholeBlob = await fetchBlobWithRetry(worldImageryUrl(report.lat, report.lon, sinkholeBuf, 640, 480));
    if (currentReport === report) {
      report.sinkholeBasemapDataUrl = await blobToDataUrl(sinkholeBlob);
    }
  } catch (e) {
    console.warn('PDF sinkhole basemap prefetch failed:', e);
  }
}

// =========================================================================
// REPORT RUNNER & RENDERER
// =========================================================================

export async function runReport() {
  const addressInput = document.getElementById('address-input') as HTMLInputElement | null;
  const addressRaw = (addressInput?.value || '').trim();
  if (!addressRaw) {
    setStatus('Enter a U.S. address to generate a report.', true);
    return;
  }
  const btn = document.getElementById('go-btn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  setStatus('Locating address via geocoding…');

  try {
    const geo = await geocode(addressRaw);
    const lat = parseFloat(geo.lat), lon = parseFloat(geo.lon);
    const addr = geo.address || {};
    const stateAbbr = (addr['ISO3166-2-lvl4'] || '').split('-')[1] || stateNameToAbbr(addr.state);
    const county = addr.county || '';

    setStatus('Querying FEMA Flood Zone map & elevation data…');
    let flood: FloodZoneResult | null = null, floodErr = false;
    try {
      flood = await getFloodZone(lat, lon);
    } catch {
      floodErr = true;
    }

    setStatus('Analyzing location-level sinkhole & karst geology…');
    let sinkhole: SinkholeAssessment;
    let sinkholeErr = false;
    try {
      sinkhole = await evaluateLocationSinkholeRisk(lat, lon, stateAbbr);
    } catch (e) {
      console.error('Sinkhole assessment error:', e);
      sinkholeErr = true;
      sinkhole = {
        tier: 1,
        tierLabel: 'Undetermined',
        tag: 'low',
        closestSinkhole: null,
        pointsWithin1Mi: 0,
        pointsWithin3Mi: 0,
        pointsWithin5Mi: 0,
        allPoints: [],
        underlyingBedrock: null,
        geologyPolygons: [],
        flVulnerability: null,
        summaryExplanation: 'Location-level sinkhole data could not be retrieved at this time.',
        sourceDescription: 'Geological data temporarily unavailable.'
      };
    }

    setStatus('Checking FEMA National Risk Index (wildfire, earthquake, tornado)…');
    let nriHazards: { wildfire: NriHazard; earthquake: NriHazard; tornado: NriHazard } | null = null, nriErr = false;
    try {
      nriHazards = await getNriHazards(lat, lon);
    } catch {
      nriErr = true;
    }
    const wildfire = nriHazards?.wildfire ?? null;
    const earthquake = nriHazards?.earthquake ?? null;
    const tornado = nriHazards?.tornado ?? null;

    setStatus('Pulling historical declared disasters (OpenFEMA)…');
    let disasters: any[] = [], disasterErr = false;
    try {
      disasters = await getDisasterHistory(stateAbbr, county);
    } catch {
      disasterErr = true;
    }

    setStatus('Checking EPA Superfund & regulated facilities nearby…');
    let epa: { general: any[]; generalOk: boolean; superfund: any[] } | null = null, epaErr = false;
    try {
      epa = await getEpaFacilities(lat, lon);
    } catch {
      epaErr = true;
    }

    setStatus('Computing wind exposure and insurance estimates…');
    const windEst = estimateWindTier(stateAbbr, lat, lon);
    const windTier = windEst.tier;
    const windDistanceMiles = windEst.distanceMiles;
    const homeValue = parseHomeValue();
    const mitigated = (document.getElementById('home-mitigated') as HTMLInputElement)?.checked ?? false;
    const deductiblePct = parseInt((document.getElementById('hurricane-deductible') as HTMLSelectElement)?.value || '2', 10);

    const zoneKey = flood ? normalizeZoneKey(flood.zone, flood.subtype) : 'D';
    const zoneInfo = FLOOD_ZONE_INFO[zoneKey] || FLOOD_ZONE_INFO['D'];

    if (!floodManuallySet) {
      const floodCheck = document.getElementById('include-flood') as HTMLInputElement | null;
      if (floodCheck) floodCheck.checked = zoneInfo.risk >= 4;
    }
    const includeFlood = (document.getElementById('include-flood') as HTMLInputElement)?.checked ?? false;

    currentReport = {
      addressRaw,
      displayName: geo.display_name,
      lat,
      lon,
      stateAbbr,
      county,
      flood,
      floodErr,
      zoneKey,
      zoneInfo,
      disasters,
      disasterErr,
      windTier,
      windDistanceMiles,
      homeValue,
      mitigated,
      deductiblePct,
      includeFlood,
      wildfire,
      wildfireErr: nriErr,
      earthquake,
      earthquakeErr: nriErr,
      tornado,
      tornadoErr: nriErr,
      sinkhole,
      sinkholeErr,
      epa,
      epaErr,
      generatedAt: new Date()
    };

    const reportEl = document.getElementById('report');
    if (reportEl) reportEl.style.display = 'block';
    renderReport(currentReport);
    setStatus('');
    reportEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    prefetchPdfMapImage(currentReport);
  } catch (e) {
    console.error(e);
    setStatus('Could not locate that address. Try adding city and state, e.g. "1200 Ocean Dr, Miami Beach, FL".', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderReport(r: ReportData) {
  const repAddr = document.getElementById('rep-addr');
  const repMeta = document.getElementById('rep-meta');
  const footerGen = document.getElementById('footer-generated');
  if (repAddr) repAddr.textContent = r.displayName;
  if (repMeta) {
    repMeta.innerHTML =
      'lat/lon ' + r.lat.toFixed(4) + ', ' + r.lon.toFixed(4) +
      '<br>generated ' + r.generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  if (footerGen) footerGen.textContent = 'Generated ' + r.generatedAt.toLocaleString('en-US');

  // Summary strip
  const windMeta = tierMeta(r.windTier);
  const scale = Math.min(Math.max(r.homeValue / 350000, 0.5), 3);
  const [homeLo, homeHi] = scoreToHomeRange(r.windTier, scale, r.mitigated, r.deductiblePct);
  const [floodLoRaw, floodHiRaw] = scoreToFloodRange(r.zoneInfo.risk, scale * disasterFrequencyBump(r.disasters.length));
  const floodLo = r.includeFlood ? floodLoRaw : 0;
  const floodHi = r.includeFlood ? floodHiRaw : 0;
  const combinedLabel = r.includeFlood ? 'Est. combined annual insurance' : 'Est. homeowners-only annual insurance';

  const strip = document.getElementById('summary-strip');
  if (strip) {
    strip.innerHTML = `
      <div class="cell">
        <div class="figure">${r.floodErr ? 'N/A' : r.zoneKey}</div>
        <div class="label">FEMA flood zone</div>
        <div class="tag ${r.floodErr ? 'unk' : r.zoneInfo.tag}">${r.floodErr ? 'unavailable' : r.zoneInfo.tag + ' risk'}</div>
      </div>
      <div class="cell">
        <div class="figure">Tier ${r.windTier}/5</div>
        <div class="label">Hurricane wind exposure</div>
        <div class="tag ${windMeta.tag}">${windMeta.name.toLowerCase()}</div>
      </div>
      <div class="cell">
        <div class="figure">Tier ${r.sinkhole.tier}/5</div>
        <div class="label">Sinkhole risk (location-level)</div>
        <div class="tag ${r.sinkhole.tag}">${r.sinkhole.tierLabel.toLowerCase()}</div>
      </div>
      <div class="cell">
        <div class="figure">${fmt(homeLo + floodLo)}–${fmt(homeHi + floodHi)}</div>
        <div class="label">${combinedLabel}</div>
      </div>
    `;
  }

  // --- Flood Section ---
  const floodZoneName = document.getElementById('flood-zone-name');
  const floodZoneDesc = document.getElementById('flood-zone-desc');
  const floodZoneCode = document.getElementById('flood-zone-code');
  const floodBfe = document.getElementById('flood-bfe');
  const floodCoords = document.getElementById('flood-coords');
  const floodNote = document.getElementById('flood-note');

  if (floodZoneName) floodZoneName.textContent = r.floodErr ? 'Flood zone data unavailable' : r.zoneInfo.name;
  if (floodZoneDesc) {
    floodZoneDesc.textContent = r.floodErr
      ? 'The FEMA National Flood Hazard Layer service could not be reached for this location just now.'
      : r.zoneInfo.desc;
  }
  if (floodZoneCode) floodZoneCode.textContent = r.floodErr ? '—' : r.zoneKey;
  if (floodBfe) floodBfe.textContent = !r.floodErr && r.flood?.bfe ? r.flood.bfe + ' ft (NAVD88)' : 'Not on record';
  if (floodCoords) floodCoords.textContent = r.lat.toFixed(5) + ', ' + r.lon.toFixed(5);
  if (floodNote) {
    floodNote.textContent = r.floodErr
      ? ''
      : r.flood?.source === 'living-atlas'
      ? 'Source: Esri Living Atlas independently hosted mirror of FEMA data. Screening lookup, not an official LOMA.'
      : 'Source: FEMA National Flood Hazard Layer (NFHL). Screening lookup, not an official LOMA.';
  }
  loadFloodMap(r.lat, r.lon, r.floodErr);

  // --- Wind Section ---
  const windTierName = document.getElementById('wind-tier-name');
  const windDesc = document.getElementById('wind-desc');
  const windDistance = document.getElementById('wind-distance');
  const windBar = document.getElementById('wind-bar');
  const windMarker = document.getElementById('wind-marker');

  if (windTierName) windTierName.textContent = windMeta.name + ' — Tier ' + r.windTier + ' of 5';
  if (windDesc) windDesc.textContent = windDescription(r.stateAbbr, r.windTier, r.windDistanceMiles);
  if (windDistance) {
    windDistance.textContent =
      (STATE_WIND_TIER[r.stateAbbr] || STATE_WIND_TIER.DEFAULT) <= 1
        ? 'not applicable (non-hurricane region)'
        : r.windDistanceMiles + ' mi';
  }
  const barColors = ['#3C6E52', '#6E8F52', '#AD6E28', '#C4762B', '#96382A'];
  if (windBar) {
    windBar.innerHTML = barColors
      .map((c, i) => `<span style="background:${i < r.windTier ? c : 'var(--line-soft)'}"></span>`)
      .join('');
  }
  if (windMarker) {
    windMarker.innerHTML = `<div class="marker" style="left:${((r.windTier - 0.5) / 5) * 100}%">Tier ${r.windTier}</div>`;
  }

  // --- FEMA NRI Hazards: Wildfire, Earthquake, Tornado ---
  renderNriBar('wildfire', r.wildfire, r.wildfireErr, 'Wildfire', 'not a parcel-specific vegetation or defensible space inspection.');
  renderNriBar('earthquake', r.earthquake, r.earthquakeErr, 'Earthquake', 'not a site-specific soil or fault-line study.');
  renderNriBar('tornado', r.tornado, r.tornadoErr, 'Tornado', 'not a structure-specific assessment.');

  // --- SECTION 06: LOCATION-LEVEL SINKHOLE RISK & INTERACTIVE MAP ---
  renderSinkholeSection(r);

  // --- Disaster History ---
  const disasterIntro = document.getElementById('disaster-intro');
  const disasterTimeline = document.getElementById('disaster-timeline');
  if (disasterIntro) {
    disasterIntro.textContent = r.disasterErr
      ? 'Disaster history could not be retrieved right now.'
      : r.county
      ? `Federally declared disasters affecting ${r.county}, ${r.stateAbbr}, since 2000:`
      : 'Federally declared disasters affecting this county since 2000:';
  }
  if (disasterTimeline) {
    if (r.disasterErr) {
      disasterTimeline.innerHTML = '';
    } else if (!r.disasters.length) {
      disasterTimeline.innerHTML = '<p class="no-events">No federally declared disasters found for this county since 2000.</p>';
    } else {
      disasterTimeline.innerHTML = r.disasters
        .map(
          d => `
        <div class="tl-item">
          <div class="yr">${new Date(d.declarationDate).getFullYear()}</div>
          <div class="ttl">${escapeHtml(d.incidentType || 'Disaster')}</div>
          <div class="sub">${escapeHtml(d.declarationTitle || '')}</div>
        </div>
      `
        )
        .join('');
    }
  }

  // --- EPA Environmental Hazards ---
  const epaIntro = document.getElementById('epa-intro');
  const epaList = document.getElementById('epa-list');
  if (epaIntro && epaList) {
    if (r.epaErr) {
      epaIntro.textContent = 'EPA Superfund site data could not be retrieved right now.';
      epaList.innerHTML = '';
    } else {
      const generalOk = r.epa?.generalOk;
      const generalCount = r.epa?.general ? r.epa.general.length : 0;
      const superfundCount = r.epa?.superfund ? r.epa.superfund.length : 0;
      const generalPhrase = generalOk
        ? `${generalCount} other EPA-regulated facilit${generalCount === 1 ? 'y' : 'ies'} within 1 mile`
        : 'broader facility search unavailable';
      epaIntro.textContent = `${superfundCount} Superfund (NPL) site${superfundCount === 1 ? '' : 's'} found within 3 miles, and ${generalPhrase}:`;

      const items: string[] = [];
      (r.epa?.superfund || []).forEach((f: any) => {
        const city = f.City || f.CityName || '', state = f.State || f.StateAbbr || '';
        items.push(
          `<div class="tl-item"><div class="yr" style="color:var(--risk-high);">NPL</div><div class="ttl">${escapeHtml(
            f.NAME || f.FacilityName || 'Superfund site'
          )}</div><div class="sub">${escapeHtml(city)}${city ? ', ' : ''}${escapeHtml(state)} — Superfund NPL site${
            f.NPL_STATUS ? ' (' + escapeHtml(f.NPL_STATUS) + ')' : ''
          }</div></div>`
        );
      });
      if (generalOk) {
        (r.epa?.general || []).slice(0, 8).forEach((f: any) => {
          const city = f.CityName || f.City || '', state = f.StateAbbr || f.State || '';
          items.push(
            `<div class="tl-item"><div class="yr">•</div><div class="ttl">${escapeHtml(
              f.FacilityName || f.NAME || 'EPA-regulated facility'
            )}</div><div class="sub">${escapeHtml(city)}${city ? ', ' : ''}${escapeHtml(state)}</div></div>`
          );
        });
      }
      epaList.innerHTML = items.length ? items.join('') : '';
    }
  }

  // --- Insurance Cost Range ---
  const insHomeValEcho = document.getElementById('ins-homeval-echo');
  const insDeductibleEcho = document.getElementById('ins-deductible-echo');
  const insDeductibleDollars = document.getElementById('ins-deductible-dollars');
  const insHome = document.getElementById('ins-home');
  const insFlood = document.getElementById('ins-flood');
  const insTotal = document.getElementById('ins-total');
  const lenderNote = document.getElementById('flood-lender-note');

  const deductibleDollars = Math.round((r.homeValue * (r.deductiblePct / 100)) / 100) * 100;
  if (insHomeValEcho) insHomeValEcho.textContent = fmt(r.homeValue);
  if (insDeductibleEcho) insDeductibleEcho.textContent = r.deductiblePct + '%';
  if (insDeductibleDollars) insDeductibleDollars.textContent = fmt(deductibleDollars);
  if (insHome) insHome.textContent = fmt(homeLo) + ' – ' + fmt(homeHi);

  if (insFlood) {
    const floodCard = insFlood.closest('.ins-range') as HTMLElement | null;
    if (r.includeFlood) {
      if (floodCard) floodCard.style.opacity = '1';
      insFlood.textContent = fmt(floodLo) + ' – ' + fmt(floodHi);
    } else {
      if (floodCard) floodCard.style.opacity = '0.55';
      insFlood.textContent = 'Not included';
    }
  }

  if (insTotal) {
    insTotal.textContent =
      fmt(homeLo + floodLo) + ' – ' + fmt(homeHi + floodHi) + ' / yr' + (r.includeFlood ? '' : ' (homeowners only)');
  }

  if (lenderNote) {
    if (!r.includeFlood && !r.floodErr && r.zoneInfo.risk >= 4) {
      lenderNote.style.display = 'block';
      lenderNote.textContent =
        'This property sits in a high-risk flood zone (' +
        r.zoneKey +
        '). Lenders typically require flood insurance here for federally backed mortgages, even though it is excluded from the estimate above.';
    } else {
      lenderNote.style.display = 'none';
    }
  }
}

function renderNriBar(idPrefix: string, hazard: NriHazard | null, err: boolean, noun: string, unstudiedNote: string) {
  const tierName = document.getElementById(idPrefix + '-tier-name');
  const desc = document.getElementById(idPrefix + '-desc');
  const bar = document.getElementById(idPrefix + '-bar');
  const marker = document.getElementById(idPrefix + '-marker');
  const colors = ['#3C6E52', '#6E8F52', '#AD6E28', '#C4762B', '#96382A'];

  if (err || !hazard) {
    if (tierName) tierName.textContent = noun + ' data unavailable';
    if (desc) desc.textContent = 'FEMA\u2019s National Risk Index service could not be reached just now.';
    if (bar) bar.innerHTML = colors.map(() => '<span style="background:var(--line-soft)"></span>').join('');
    if (marker) marker.innerHTML = '';
  } else {
    const tier = hazard.tier || 1;
    if (tierName) tierName.textContent = hazard.ratingLabel + ' — Tier ' + tier + ' of 5';
    if (desc) {
      desc.textContent =
        'FEMA rates this county\u2019s ' +
        noun.toLowerCase() +
        ' likelihood and exposure as "' +
        hazard.ratingLabel.toLowerCase() +
        '." ' +
        (typeof hazard.annualFreq === 'number'
          ? 'Modeled at roughly ' + hazard.annualFreq.toFixed(3) + ' ' + noun.toLowerCase() + ' events per year. '
          : '') +
        'County-wide planning figure, ' +
        unstudiedNote;
    }
    if (bar) {
      bar.innerHTML = colors
        .map((c, i) => `<span style="background:${i < tier ? c : 'var(--line-soft)'}"></span>`)
        .join('');
    }
    if (marker) {
      marker.innerHTML = `<div class="marker" style="left:${((tier - 0.5) / 5) * 100}%">Tier ${tier}</div>`;
    }
  }
}

function renderSinkholeSection(r: ReportData) {
  const sh = r.sinkhole;
  const tierName = document.getElementById('sinkhole-tier-name');
  const desc = document.getElementById('sinkhole-desc');
  const bar = document.getElementById('sinkhole-bar');
  const marker = document.getElementById('sinkhole-marker');
  const note = document.getElementById('sinkhole-note');

  if (tierName) tierName.textContent = `${sh.tierLabel} — Tier ${sh.tier} of 5 (Location-Level)`;
  if (desc) desc.innerHTML = sh.summaryExplanation;

  const colors = ['#3C6E52', '#6E8F52', '#AD6E28', '#C4762B', '#96382A'];
  if (bar) {
    bar.innerHTML = colors
      .map((c, i) => `<span style="background:${i < sh.tier ? c : 'var(--line-soft)'}"></span>`)
      .join('');
  }
  if (marker) {
    marker.innerHTML = `<div class="marker" style="left:${((sh.tier - 0.5) / 5) * 100}%">Tier ${sh.tier}</div>`;
  }
  if (note) note.textContent = sh.sourceDescription;

  // Key metrics cards
  const gridEl = document.getElementById('sinkhole-metrics-grid');
  if (gridEl) {
    const nearestStr = sh.closestSinkhole
      ? `${sh.closestSinkhole.distanceMiles} mi ${sh.closestSinkhole.bearing}`
      : 'None within 5 mi';
    const bedrockStr = sh.underlyingBedrock ? sh.underlyingBedrock.unitName : 'Non-karst rock / unmapped';
    const rockTypeStr = sh.underlyingBedrock
      ? `${sh.underlyingBedrock.rockType} (${sh.underlyingBedrock.exposure === 'E' ? 'Surface/shallow' : 'Buried/covered'})`
      : 'Low dissolution susceptibility';

    gridEl.innerHTML = `
      <div class="datum"><div class="k">Nearest documented sinkhole</div><div class="v">${nearestStr}</div></div>
      <div class="datum"><div class="k">Incidents within 1 mile</div><div class="v">${sh.pointsWithin1Mi}</div></div>
      <div class="datum"><div class="k">Incidents within 3 miles</div><div class="v">${sh.pointsWithin3Mi}</div></div>
      <div class="datum"><div class="k">Underlying formation</div><div class="v" style="font-size:16px;">${escapeHtml(bedrockStr)}</div></div>
      <div class="datum"><div class="k">Rock lithology & exposure</div><div class="v" style="font-size:16px;">${escapeHtml(rockTypeStr)}</div></div>
    `;
  }

  // Load the Interactive Sinkhole Map
  loadSinkholeMap(r.lat, r.lon, r);

  // Render list of closest documented sinkholes
  const listEl = document.getElementById('sinkhole-incidents-list');
  const tableContainer = document.getElementById('sinkhole-incidents-container');
  if (listEl && tableContainer) {
    if (!sh.allPoints.length) {
      tableContainer.style.display = 'none';
    } else {
      tableContainer.style.display = 'block';
      const items = sh.allPoints.slice(0, 10).map((pt, idx) => {
        return `
          <tr id="sinkhole-row-${idx}" style="border-bottom:1px solid var(--line-soft);transition:background .3s ease;cursor:pointer;" onclick="window.selectSinkholeFromTable(${idx})" title="Click to view on sinkhole map">
            <td style="padding:10px 8px;font-family:var(--mono);font-size:13px;font-weight:600;color:var(--ink);">${escapeHtml(pt.id)}</td>
            <td style="padding:10px 8px;font-family:var(--mono);font-size:13px;font-weight:600;color:${pt.distanceMiles <= 1.0 ? '#DC2626' : '#D97706'};">${pt.distanceMiles} mi ${pt.bearing}</td>
            <td style="padding:10px 8px;font-size:12.5px;color:var(--ink-soft);">${pt.date || 'Historic / unrecorded'}</td>
            <td style="padding:10px 8px;font-family:var(--mono);font-size:12px;">${pt.depthFt ? pt.depthFt + ' ft depth' : '—'}</td>
            <td style="padding:10px 8px;font-size:12px;color:var(--ink-soft);">${escapeHtml(pt.comments || pt.verified || 'Recorded subsidence event')}</td>
          </tr>
        `;
      });
      listEl.innerHTML = items.join('');
    }
  }
}

function windDescription(stateAbbr: string, tier: number, distanceMiles: number): string {
  const baseTier = STATE_WIND_TIER[stateAbbr] || STATE_WIND_TIER.DEFAULT;
  if (baseTier <= 1) {
    return 'This state has little to no hurricane climatology, so distance to a coastline was not used as a wind-exposure factor here.';
  }
  const distNote =
    distanceMiles <= 2
      ? `Sitting within roughly ${distanceMiles} miles of the coast, this is about as exposed to direct hurricane winds and storm surge as inland property gets.`
      : distanceMiles <= 10
      ? `At roughly ${distanceMiles} miles from the coast, this property sits close enough to the shoreline that exposure is bumped up from this state's regional baseline.`
      : distanceMiles <= 30
      ? `At roughly ${distanceMiles} miles from the coast, this sits near this state's regional baseline hurricane exposure.`
      : distanceMiles <= 75
      ? `At roughly ${distanceMiles} miles inland, wind speeds during landfall are typically lower than at the immediate coast, so exposure is stepped down.`
      : `At roughly ${distanceMiles} miles inland, hurricanes reaching this location have usually weakened well below coastal landfall intensity.`;
  return distNote + ' Distance is measured to nearest sampled coastline point.';
}

export function resetSearch() {
  const report = document.getElementById('report');
  const input = document.getElementById('address-input') as HTMLInputElement | null;
  if (report) report.style.display = 'none';
  if (input) input.value = '';
  floodManuallySet = false;
  setStatus('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Map Controls: Zoom in / Zoom out / Basemap Toggle
export function setSinkholeZoom(miles: number) {
  sinkholeMapZoomMiles = miles;
  const btns = document.querySelectorAll('.sh-zoom-btn');
  btns.forEach(b => {
    const val = parseFloat((b as HTMLElement).getAttribute('data-zoom') || '2');
    b.classList.toggle('active', val === miles);
  });
  if (currentReport) {
    loadSinkholeMap(currentReport.lat, currentReport.lon, currentReport);
  }
}

export function toggleSinkholeBasemap(type: string) {
  sinkholeMapType = type;
  const btns = document.querySelectorAll('.sh-type-btn');
  btns.forEach(b => {
    const val = (b as HTMLElement).getAttribute('data-type') || 'satellite';
    b.classList.toggle('active', val === type);
  });
  if (currentReport) {
    loadSinkholeMap(currentReport.lat, currentReport.lon, currentReport);
  }
}

// =========================================================================
// PDF EXPORT WITH FLOOD MAP & SINKHOLE MAP EMBEDDED
// =========================================================================

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  };
}

function blendWithWhite(hex: string, alpha: number) {
  const c = hexToRgb(hex);
  return {
    r: Math.round(c.r * alpha + 255 * (1 - alpha)),
    g: Math.round(c.g * alpha + 255 * (1 - alpha)),
    b: Math.round(c.b * alpha + 255 * (1 - alpha))
  };
}

function drawFilledPolygon(doc: any, absPoints: [number, number][], color: { r: number; g: number; b: number }) {
  if (absPoints.length < 3) return;
  const segments: [number, number][] = [];
  for (let i = 1; i < absPoints.length; i++) {
    segments.push([absPoints[i][0] - absPoints[i - 1][0], absPoints[i][1] - absPoints[i - 1][1]]);
  }
  doc.setFillColor(color.r, color.g, color.b);
  doc.lines(segments, absPoints[0][0], absPoints[0][1], [1, 1], 'F', true);
}

export async function downloadPDF() {
  if (!currentReport) return;
  const r = currentReport;
  const btn = document.getElementById('pdf-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Preparing PDF…';
  }

  // Ensure map data is prefetched if needed
  if (!r.mapBasemapDataUrl || !r.mapZoneFeatures || !r.sinkholeBasemapDataUrl) {
    try {
      await prefetchPdfMapImage(r);
    } catch (e) {
      console.warn('Map prefetch retry warning:', e);
    }
  }

  try {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 48;
    let y = 48;

    function ensureRoom(h: number) {
      if (y + h > 745) {
        doc.addPage();
        y = 48;
      }
    }

    function heading(text: string, size = 13) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(24, 33, 41);
      ensureRoom(size + 10);
      doc.text(text, marginX, y);
      y += size + 8;
    }

    function body(text: string, size = 10) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(70, 80, 86);
      const lines = doc.splitTextToSize(text, pageW - marginX * 2);
      ensureRoom(lines.length * (size * 1.35));
      doc.text(lines, marginX, y);
      y += lines.length * (size * 1.35) + 6;
    }

    function rule() {
      doc.setDrawColor(200, 205, 190);
      doc.setLineWidth(0.8);
      doc.line(marginX, y, pageW - marginX, y);
      y += 14;
    }

    function datum(label: string, value: string | number, x: number) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(140, 150, 140);
      doc.text(label, x, y);
      doc.setFont('courier', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(24, 33, 41);
      doc.text(String(value), x, y + 14);
    }

    function drawTierBar(tier: number) {
      const segColors = ['#3C6E52', '#6E8F52', '#AD6E28', '#C4762B', '#96382A'];
      const width = pageW - marginX * 2, barHeight = 8, segGap = 1.2;
      const segWidth = width / 5;
      const tierNum = Math.max(1, Math.min(5, tier || 1));
      ensureRoom(32);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(24, 33, 41);
      doc.text('Tier ' + tierNum, marginX + (tierNum - 0.5) * segWidth, y, { align: 'center' });
      y += 7;
      for (let i = 0; i < 5; i++) {
        const segX = marginX + i * segWidth;
        const c = hexToRgb(i < tierNum ? segColors[i] : '#DBDFD2');
        doc.setFillColor(c.r, c.g, c.b);
        doc.rect(segX, y, segWidth - segGap, barHeight, 'F');
      }
      y += barHeight + 9;
      const labels = ['Very low', 'Low', 'Moderate', 'High', 'Very high'];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(139, 151, 141);
      labels.forEach((lbl, i) => {
        if (i === 0) doc.text(lbl, marginX, y, { align: 'left' });
        else if (i === 4) doc.text(lbl, marginX + width, y, { align: 'right' });
        else doc.text(lbl, marginX + (i + 0.5) * segWidth, y, { align: 'center' });
      });
      y += 14;
    }

    // Cover header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(24, 33, 41);
    doc.text('Groundtruth — Property Hazard Report', marginX, y);
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(70, 80, 86);
    const addrLines = doc.splitTextToSize(r.displayName, pageW - marginX * 2);
    doc.text(addrLines, marginX, y);
    y += addrLines.length * 14 + 4;

    doc.setFontSize(8.5);
    doc.setTextColor(140, 150, 140);
    doc.text('Generated ' + r.generatedAt.toLocaleString('en-US') + '   |   lat/lon ' + r.lat.toFixed(4) + ', ' + r.lon.toFixed(4), marginX, y);
    y += 16;

    // --- SUMMARY STRIP (Matches the 4 top cards on website) ---
    const scale = Math.min(Math.max(r.homeValue / 350000, 0.5), 3);
    const windMeta = tierMeta(r.windTier);
    const [homeLo, homeHi] = scoreToHomeRange(r.windTier, scale, r.mitigated, r.deductiblePct);
    const [floodLoRaw, floodHiRaw] = scoreToFloodRange(r.zoneInfo.risk, scale * disasterFrequencyBump(r.disasters.length));
    const floodLo = r.includeFlood ? floodLoRaw : 0;
    const floodHi = r.includeFlood ? floodHiRaw : 0;

    ensureRoom(64);
    const cardW = (pageW - marginX * 2 - 18) / 4;
    const cardH = 50;
    const stripY = y;

    const cards = [
      {
        val: r.floodErr ? 'N/A' : r.zoneKey,
        label: 'FEMA flood zone',
        tag: r.floodErr ? 'unavailable' : r.zoneInfo.tag + ' risk',
        tagBg: r.zoneInfo.tag === 'high' ? '#F1D9D2' : r.zoneInfo.tag === 'mod' ? '#F0E1C8' : '#D6E7DB',
        tagColor: r.zoneInfo.tag === 'high' ? '#96382A' : r.zoneInfo.tag === 'mod' ? '#AD6E28' : '#3C6E52'
      },
      {
        val: `Tier ${r.windTier}/5`,
        label: 'Hurricane exposure',
        tag: windMeta.name.toLowerCase(),
        tagBg: windMeta.tag === 'high' ? '#F1D9D2' : windMeta.tag === 'mod' ? '#F0E1C8' : '#D6E7DB',
        tagColor: windMeta.tag === 'high' ? '#96382A' : windMeta.tag === 'mod' ? '#AD6E28' : '#3C6E52'
      },
      {
        val: `Tier ${r.sinkhole.tier}/5`,
        label: 'Sinkhole risk (local)',
        tag: r.sinkhole.tierLabel.toLowerCase(),
        tagBg: r.sinkhole.tag === 'high' ? '#F1D9D2' : r.sinkhole.tag === 'mod' ? '#F0E1C8' : '#D6E7DB',
        tagColor: r.sinkhole.tag === 'high' ? '#96382A' : r.sinkhole.tag === 'mod' ? '#AD6E28' : '#3C6E52'
      },
      {
        val: `${fmt(homeLo + floodLo)}–${fmt(homeHi + floodHi)}`,
        label: r.includeFlood ? 'Est. combined ins.' : 'Est. home-only ins.',
        tag: 'annual est.',
        tagBg: '#DBDFD2',
        tagColor: '#4C5A62'
      }
    ];

    cards.forEach((c, idx) => {
      const cx = marginX + idx * (cardW + 6);
      doc.setFillColor(248, 249, 242);
      doc.setDrawColor(201, 207, 192);
      doc.setLineWidth(0.8);
      doc.rect(cx, stripY, cardW, cardH, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(24, 33, 41);
      doc.text(c.val, cx + 7, stripY + 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(76, 90, 98);
      doc.text(c.label, cx + 7, stripY + 28);

      const tagBgC = hexToRgb(c.tagBg);
      const tagTxtC = hexToRgb(c.tagColor);
      doc.setFillColor(tagBgC.r, tagBgC.g, tagBgC.b);
      const tagW = doc.getTextWidth(c.tag) * 0.95 + 8;
      doc.roundedRect(cx + 7, stripY + 34, tagW, 11, 2, 2, 'F');
      doc.setTextColor(tagTxtC.r, tagTxtC.g, tagTxtC.b);
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      doc.text(c.tag, cx + 11, stripY + 42);
    });

    y = stripY + cardH + 18;
    rule();

    // =========================================================================
    // 1. FEMA FLOOD ZONE (WITH LABELED MAP)
    // =========================================================================
    heading('1. FEMA Flood Zone');
    body(r.floodErr ? 'Flood zone service unavailable at generation time.' : r.zoneInfo.name);
    if (!r.floodErr) body(r.zoneInfo.desc);
    ensureRoom(40);
    datum('ZONE', r.floodErr ? '—' : r.zoneKey, marginX);
    datum('BASE FLOOD ELEV.', !r.floodErr && r.flood?.bfe ? r.flood.bfe + ' ft' : 'Not on record', marginX + 160);
    datum('COORDINATES', `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`, marginX + 320);
    y += 34;

    if (r.mapBasemapDataUrl || r.mapZoneFeatures) {
      try {
        const mapW = pageW - marginX * 2, mapH = mapW * (480 / 640);
        ensureRoom(mapH + 20);
        if (r.mapBasemapDataUrl) doc.addImage(r.mapBasemapDataUrl, 'PNG', marginX, y, mapW, mapH);

        const buf = PDF_MAP_BUF;
        const minLon = r.lon - buf, maxLon = r.lon + buf, minLat = r.lat - buf, maxLat = r.lat + buf;
        const mapTop = y;
        function toFloodPdf(lon: number, lat: number): [number, number] {
          return [
            marginX + ((lon - minLon) / (maxLon - minLon)) * mapW,
            mapTop + mapH - ((lat - minLat) / (maxLat - minLat)) * mapH
          ];
        }

        doc.saveGraphicsState();
        doc.rect(marginX, mapTop, mapW, mapH, null);
        doc.clip();
        doc.discardPath();

        // 1. Draw flood zone polygon fills & boundary lines
        if (r.mapZoneFeatures && r.mapZoneFeatures.length) {
          r.mapZoneFeatures.forEach(f => {
            const rings = f.geometry?.rings || [];
            const zone = (f.attributes?.FLD_ZONE || '').trim();
            const info = FLOOD_ZONE_INFO[normalizeZoneKey(zone, '')] || FLOOD_ZONE_INFO['D'];
            const colorHex = { high: '#96382A', mod: '#AD6E28', low: '#3C6E52', unk: '#8b978d' }[info.tag] || '#8b978d';
            const fillColor = blendWithWhite(colorHex, 0.52);
            const strokeColor = hexToRgb(colorHex);

            rings.forEach((ring: [number, number][]) => {
              const pts = ring.map(pt => toFloodPdf(pt[0], pt[1])) as [number, number][];
              doc.setDrawColor(strokeColor.r, strokeColor.g, strokeColor.b);
              doc.setLineWidth(0.9);
              drawFilledPolygon(doc, pts, fillColor);
            });
          });

          // 2. Draw Flood Zone Labels on each mapped polygon!
          r.mapZoneFeatures.forEach(f => {
            const rings = f.geometry?.rings || [];
            const zone = (f.attributes?.FLD_ZONE || '').trim();
            if (!zone) return;

            rings.forEach((ring: [number, number][]) => {
              const pts = ring.map(pt => toFloodPdf(pt[0], pt[1])) as [number, number][];
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
              let sumX = 0, sumY = 0;
              pts.forEach(([px, py]) => {
                minX = Math.min(minX, px);
                maxX = Math.max(maxX, px);
                minY = Math.min(minY, py);
                maxY = Math.max(maxY, py);
                sumX += px;
                sumY += py;
              });

              // If shape is sufficiently large, draw prominent zone label badge
              if (maxX - minX > 20 && maxY - minY > 12) {
                const cx = sumX / pts.length;
                const cy = sumY / pts.length;
                const pillW = Math.max(zone.length * 7.5 + 10, 24);
                const pillH = 13;
                doc.setFillColor(248, 249, 242);
                doc.setDrawColor(24, 33, 41);
                doc.setLineWidth(0.8);
                doc.roundedRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 2, 2, 'FD');
                doc.setFont('courier', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(24, 33, 41);
                doc.text(zone, cx, cy + 3.0, { align: 'center' });
              }
            });
          });
        }

        // 3. Draw Target Property Pin
        const [targetX, targetY] = toFloodPdf(r.lon, r.lat);
        doc.setFillColor(29, 78, 216);
        doc.circle(targetX, targetY, 6, 'F');
        doc.setFillColor(248, 249, 242);
        doc.circle(targetX, targetY, 3.8, 'F');
        doc.setFillColor(29, 78, 216);
        doc.circle(targetX, targetY, 2.2, 'F');
        doc.setDrawColor(29, 78, 216);
        doc.setLineWidth(1.2);
        doc.line(targetX - 10, targetY, targetX - 5, targetY);
        doc.line(targetX + 5, targetY, targetX + 10, targetY);
        doc.line(targetX, targetY - 10, targetX, targetY - 5);
        doc.line(targetX, targetY + 5, targetX, targetY + 10);

        // Parcel Zone badge near marker
        if (!r.floodErr && r.zoneKey) {
          const badgeText = `Parcel Zone: ${r.zoneKey}`;
          const bW = doc.getTextWidth(badgeText) * 0.9 + 10;
          doc.setFillColor(29, 78, 216);
          doc.roundedRect(targetX - bW / 2, targetY - 19, bW, 11, 2, 2, 'F');
          doc.setFont('courier', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(248, 249, 242);
          doc.text(badgeText, targetX, targetY - 11, { align: 'center' });
        }

        // 4. Map Legend Overlay (Generous width to ensure all text stays within frame)
        doc.setFillColor(248, 249, 242);
        doc.setDrawColor(201, 207, 192);
        doc.setLineWidth(0.8);
        const legW = 225, legH = 38;
        const legX = marginX + mapW - legW - 8, legY = mapTop + mapH - legH - 8;
        doc.roundedRect(legX, legY, legW, legH, 3, 3, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(24, 33, 41);

        // Column 1
        doc.setFillColor(29, 78, 216); // Royal Blue for Target Parcel
        doc.circle(legX + 10, legY + 11, 3.2, 'F');
        doc.setFillColor(255, 255, 255);
        doc.circle(legX + 10, legY + 11, 1.4, 'F');
        doc.setFillColor(29, 78, 216);
        doc.circle(legX + 10, legY + 11, 0.7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(29, 78, 216);
        doc.text('Target Parcel', legX + 18, legY + 13);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(24, 33, 41);

        doc.setFillColor(240, 225, 200);
        doc.setDrawColor(173, 110, 40);
        doc.rect(legX + 6, legY + 22, 8, 8, 'FD');
        doc.text('0.2% Annual (X500)', legX + 18, legY + 28);

        // Column 2
        doc.setFillColor(241, 217, 210);
        doc.setDrawColor(150, 56, 42);
        doc.rect(legX + 112, legY + 7, 8, 8, 'FD');
        doc.text('High-Risk Flood Zone', legX + 124, legY + 13);

        doc.setFillColor(214, 231, 219);
        doc.setDrawColor(60, 110, 82);
        doc.rect(legX + 112, legY + 22, 8, 8, 'FD');
        doc.text('Minimal Risk (Zone X)', legX + 124, legY + 28);

        doc.restoreGraphicsState();

        y += mapH + 8;
        body('Aerial imagery (Esri) with FEMA flood zone boundaries overlaid (Esri Living Atlas mirror). Crosshair pin marks parcel.', 8.5);
      } catch {
        body('Flood map image could not be embedded into this PDF.');
      }
    }
    rule();

    // =========================================================================
    // 2. HURRICANE / WIND EXPOSURE
    // =========================================================================
    heading('2. Hurricane / Wind Exposure');
    body(windMeta.name + ' — Tier ' + r.windTier + ' of 5');
    body(windDescription(r.stateAbbr, r.windTier, r.windDistanceMiles));
    drawTierBar(r.windTier);
    rule();

    // =========================================================================
    // 3. WILDFIRE, 4. EARTHQUAKE, 5. TORNADO
    // =========================================================================
    function renderNriHazardPdf(num: string, noun: string, hazard: NriHazard | null, hazardErr: boolean) {
      heading(num + '. ' + noun + ' Risk');
      if (hazardErr || !hazard) {
        body('FEMA\u2019s National Risk Index data unavailable for this county.');
      } else {
        const tier = hazard.tier || 1;
        body(hazard.ratingLabel + ' — Tier ' + tier + ' of 5');
        body(
          'FEMA rates this county\u2019s ' +
            noun.toLowerCase() +
            ' risk as "' +
            hazard.ratingLabel.toLowerCase() +
            '." County-wide planning figure, not site-specific.',
          8.5
        );
        drawTierBar(tier);
      }
      rule();
    }
    renderNriHazardPdf('3', 'Wildfire', r.wildfire, r.wildfireErr);
    renderNriHazardPdf('4', 'Earthquake', r.earthquake, r.earthquakeErr);
    renderNriHazardPdf('5', 'Tornado', r.tornado, r.tornadoErr);

    // =========================================================================
    // 6. SINKHOLE RISK & KARST GEOLOGY (LOCATION-LEVEL WITH MAP & TABLE)
    // =========================================================================
    heading('6. Sinkhole Risk & Karst Geology (Location-Level)');
    const sh = r.sinkhole;
    body(`${sh.tierLabel} — Tier ${sh.tier} of 5 (Location-Level Assessment)`);
    body(sh.summaryExplanation.replace(/<[^>]*>/g, ''));
    drawTierBar(sh.tier);

    // 5-Metric Key Row (Matches site)
    ensureRoom(42);
    const nearestStr = sh.closestSinkhole
      ? `${sh.closestSinkhole.distanceMiles} mi ${sh.closestSinkhole.bearing}`
      : 'None in 5 mi';
    datum('NEAREST SINKHOLE', nearestStr, marginX);
    datum('WITHIN 1 MILE', `${sh.pointsWithin1Mi} recorded`, marginX + 160);
    datum('WITHIN 3 MILES', `${sh.pointsWithin3Mi} recorded`, marginX + 320);
    y += 34;

    const bedrockStr = sh.underlyingBedrock ? sh.underlyingBedrock.unitName : 'Non-karst rock / unmapped';
    const lithoStr = sh.underlyingBedrock
      ? `${sh.underlyingBedrock.rockType} (${sh.underlyingBedrock.exposure === 'E' ? 'Surface/shallow' : 'Buried'})`
      : 'Low susceptibility';
    datum('UNDERLYING FORMATION', bedrockStr, marginX);
    datum('LITHOLOGY & EXPOSURE', lithoStr, marginX + 260);
    y += 34;

    // Embed Sinkhole Map with Range Rings & Plotted Incidents
    if (r.sinkholeBasemapDataUrl) {
      try {
        const mapW = pageW - marginX * 2, mapH = mapW * (480 / 640);
        ensureRoom(mapH + 20);
        doc.addImage(r.sinkholeBasemapDataUrl, 'PNG', marginX, y, mapW, mapH);

        const sinkholeBuf = (2.0 / 69.0) * 1.15;
        const minLon = r.lon - sinkholeBuf, maxLon = r.lon + sinkholeBuf;
        const minLat = r.lat - sinkholeBuf, maxLat = r.lat + sinkholeBuf;
        const mapTop = y;

        function toSinkholePdf(lon: number, lat: number): [number, number] {
          return [
            marginX + ((lon - minLon) / (maxLon - minLon)) * mapW,
            mapTop + mapH - ((lat - minLat) / (maxLat - minLat)) * mapH
          ];
        }

        doc.saveGraphicsState();
        doc.rect(marginX, mapTop, mapW, mapH, null);
        doc.clip();
        doc.discardPath();

        // 1. Shaded Karst Bedrock Polygons (USGS)
        if (sh.geologyPolygons && sh.geologyPolygons.length) {
          const karstFill = blendWithWhite('#AD6E28', 0.65);
          doc.setDrawColor(173, 110, 40);
          doc.setLineWidth(0.8);
          sh.geologyPolygons.forEach((f: any) => {
            const rings = f.geometry?.rings || [];
            rings.forEach((ring: [number, number][]) => {
              const pts = ring.map(pt => toSinkholePdf(pt[0], pt[1])) as [number, number][];
              drawFilledPolygon(doc, pts, karstFill);
            });
          });
        }

        // 2. Concentric Distance Range Rings (0.5 mi, 1.0 mi, 2.0 mi)
        const [targetX, targetY] = toSinkholePdf(r.lon, r.lat);
        const ringDistances = [0.5, 1.0, 2.0];
        doc.setDrawColor(237, 240, 230);
        doc.setLineWidth(0.8);
        if (typeof doc.setLineDashPattern === 'function') {
          doc.setLineDashPattern([3, 3], 0);
        }
        ringDistances.forEach(distMi => {
          const latOffset = distMi / 69.0;
          const [, ringPy] = toSinkholePdf(r.lon, r.lat + latOffset);
          const rPt = Math.abs(targetY - ringPy);
          if (rPt <= mapW && rPt <= mapH) {
            doc.circle(targetX, targetY, rPt);
            doc.setFont('courier', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(248, 249, 242);
            doc.text(`${distMi} mi`, targetX, targetY - rPt + 7.5, { align: 'center' });
          }
        });
        if (typeof doc.setLineDashPattern === 'function') {
          doc.setLineDashPattern([], 0);
        }

        // 3. Documented Sinkhole Incident Dots
        sh.allPoints.forEach(pt => {
          if (pt.distanceMiles > 2.5) return;
          const [px, py] = toSinkholePdf(pt.lon, pt.lat);
          if (px >= marginX && px <= marginX + mapW && py >= mapTop && py <= mapTop + mapH) {
            const isClose = pt.distanceMiles <= 1.0;
            const pinC = isClose ? hexToRgb('#DC2626') : hexToRgb('#D97706');
            doc.setFillColor(pinC.r, pinC.g, pinC.b);
            doc.circle(px, py, isClose ? 4.8 : 3.4, 'F');
            doc.setFillColor(255, 255, 255);
            doc.circle(px, py, isClose ? 2.5 : 1.7, 'F');
            doc.setFillColor(pinC.r, pinC.g, pinC.b);
            doc.circle(px, py, isClose ? 1.2 : 0.8, 'F');
          }
        });

        // 4. Target Property Marker Pin (Vivid Royal Blue #1D4ED8 to clearly contrast with red sinkhole dots)
        doc.setDrawColor(29, 78, 216);
        doc.setLineWidth(1.4);
        doc.line(targetX - 12, targetY, targetX - 5, targetY);
        doc.line(targetX + 5, targetY, targetX + 12, targetY);
        doc.line(targetX, targetY - 12, targetX, targetY - 5);
        doc.line(targetX, targetY + 5, targetX, targetY + 12);

        doc.setFillColor(29, 78, 216);
        doc.circle(targetX, targetY, 6, 'F');
        doc.setFillColor(255, 255, 255);
        doc.circle(targetX, targetY, 3.8, 'F');
        doc.setFillColor(29, 78, 216);
        doc.circle(targetX, targetY, 2.4, 'F');
        doc.setFillColor(255, 255, 255);
        doc.circle(targetX, targetY, 0.9, 'F');

        // 5. Map Legend Overlay (Generous width to ensure all text stays cleanly within frame)
        doc.setFillColor(248, 249, 242);
        doc.setDrawColor(201, 207, 192);
        doc.setLineWidth(0.8);
        const shLegW = 225, shLegH = 38;
        const shLegX = marginX + mapW - shLegW - 8;
        const shLegY = mapTop + mapH - shLegH - 8;
        doc.roundedRect(shLegX, shLegY, shLegW, shLegH, 3, 3, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(24, 33, 41);

        // Column 1: Target Parcel (Royal Blue) & Soluble Karst Bedrock
        doc.setFillColor(29, 78, 216); // Royal Blue for Target Parcel
        doc.circle(shLegX + 10, shLegY + 11, 3.2, 'F');
        doc.setFillColor(255, 255, 255);
        doc.circle(shLegX + 10, shLegY + 11, 1.4, 'F');
        doc.setFillColor(29, 78, 216);
        doc.circle(shLegX + 10, shLegY + 11, 0.7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(29, 78, 216);
        doc.text('Target Parcel', shLegX + 18, shLegY + 13);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(24, 33, 41);

        doc.setFillColor(240, 225, 200);
        doc.setDrawColor(173, 110, 40);
        doc.rect(shLegX + 6, shLegY + 22, 8, 8, 'FD');
        doc.text('Soluble Karst Bedrock', shLegX + 18, shLegY + 28);

        // Column 2: Documented Sinkhole Incidents (Red & Amber)
        // Row 1: Documented Sinkhole (<1 mi) - Vivid Crimson Red (#DC2626)
        doc.setFillColor(220, 38, 38); // Crimson Red (#DC2626)
        doc.circle(shLegX + 118, shLegY + 11, 3.4, 'F');
        doc.setFillColor(255, 255, 255);
        doc.circle(shLegX + 118, shLegY + 11, 1.5, 'F');
        doc.setFillColor(220, 38, 38);
        doc.circle(shLegX + 118, shLegY + 11, 0.7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text('Sinkhole (<1 mi)', shLegX + 128, shLegY + 13);

        // Row 2: Documented Sinkhole (1–5 mi) - Bright Golden Amber (#D97706)
        doc.setFillColor(217, 119, 6); // Golden Amber (#D97706)
        doc.circle(shLegX + 118, shLegY + 26, 3.0, 'F');
        doc.setFillColor(255, 255, 255);
        doc.circle(shLegX + 118, shLegY + 26, 1.3, 'F');
        doc.setFillColor(217, 119, 6);
        doc.circle(shLegX + 118, shLegY + 26, 0.6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(217, 119, 6);
        doc.text('Sinkhole (1–5 mi)', shLegX + 128, shLegY + 28);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(24, 33, 41);

        doc.restoreGraphicsState();

        y += mapH + 8;
        body('Location-level sinkhole map: Aerial imagery with parcel location (crosshair), range rings, and documented sinkholes (dots) within 2 miles.', 8.5);
      } catch {
        body('Sinkhole map could not be drawn into this PDF.');
      }
    }

    // Mini Table of Closest Documented Sinkholes (Matches site table)
    if (sh.allPoints.length > 0) {
      ensureRoom(70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(24, 33, 41);
      doc.text('Documented Sinkholes in Vicinity (Nearest Records)', marginX, y);
      y += 12;

      // Table header
      doc.setFillColor(237, 240, 230);
      doc.rect(marginX, y, pageW - marginX * 2, 14, 'F');
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(76, 90, 98);
      doc.text('REF ID', marginX + 4, y + 10);
      doc.text('DISTANCE / DIR', marginX + 65, y + 10);
      doc.text('DATE', marginX + 155, y + 10);
      doc.text('DIMENSIONS', marginX + 220, y + 10);
      doc.text('FIELD NOTES & DAMAGE', marginX + 295, y + 10);
      y += 16;

      sh.allPoints.slice(0, 5).forEach((pt, rowIdx) => {
        ensureRoom(16);
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(24, 33, 41);
        doc.text(String(pt.id || `Inc-${rowIdx + 1}`).substring(0, 10), marginX + 4, y + 9);
        if (pt.distanceMiles <= 1.0) {
          doc.setTextColor(220, 38, 38);
        } else {
          doc.setTextColor(217, 119, 6);
        }
        doc.text(`${pt.distanceMiles} mi ${pt.bearing}`, marginX + 65, y + 9);
        doc.setTextColor(70, 80, 86);
        doc.text(String(pt.date || 'Unrecorded').substring(0, 12), marginX + 155, y + 9);
        doc.text(pt.depthFt ? `${pt.depthFt}ft deep` : '—', marginX + 220, y + 9);
        const noteStr = doc.splitTextToSize(String(pt.comments || pt.damage || 'Documented subsidence'), pageW - marginX * 2 - 300);
        doc.text(noteStr[0] || '—', marginX + 295, y + 9);
        y += 13;
      });
      y += 6;
    }

    body(sh.sourceDescription, 8);
    rule();

    // =========================================================================
    // 7. NEARBY HISTORICAL LOSS EVENTS (MATCHES SECTION 07 ON SITE!)
    // =========================================================================
    heading('7. Nearby Historical Loss Events');
    if (r.disasterErr) {
      body('Disaster history service unavailable at generation time.');
    } else if (!r.disasters.length) {
      body('No federally declared disasters found for this county since 2000.');
    } else {
      body(r.county ? `Federally declared disasters affecting ${r.county}, ${r.stateAbbr}, since 2000:` : 'Federally declared disasters affecting this county since 2000:');
      r.disasters.slice(0, 6).forEach(d => {
        ensureRoom(22);
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(173, 110, 40);
        doc.text(String(new Date(d.declarationDate).getFullYear()), marginX, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(24, 33, 41);
        doc.text(String(d.incidentType || ''), marginX + 38, y);
        y += 11;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(90, 98, 92);
        const subLines = doc.splitTextToSize(String(d.declarationTitle || ''), pageW - marginX * 2 - 38);
        doc.text(subLines, marginX + 38, y);
        y += subLines.length * 10 + 5;
      });
    }
    rule();

    // =========================================================================
    // 8. EPA CONTAMINATION & ENVIRONMENTAL HAZARDS (MATCHES SECTION 08 ON SITE!)
    // =========================================================================
    heading('8. EPA Contamination & Environmental Hazards');
    if (r.epaErr) {
      body('EPA site data service unavailable at generation time.');
    } else {
      const generalList = r.epa?.general || [];
      const superfundList = r.epa?.superfund || [];
      body(`${superfundList.length} Superfund (NPL) site(s) within 3 miles; ${generalList.length} other EPA-regulated facilities within 1 mile.`);
      superfundList.forEach(f => {
        ensureRoom(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(150, 56, 42);
        doc.text('NPL: ' + (f.NAME || 'Superfund site'), marginX, y);
        y += 11;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(70, 80, 86);
        doc.text((f.City || '') + ', ' + (f.State || '') + ' — ' + (f.NPL_STATUS || 'National Priorities List site'), marginX, y);
        y += 11;
      });
    }
    rule();

    // =========================================================================
    // 9. ESTIMATED INSURANCE COST RANGE (MATCHES SECTION 09 ON SITE!)
    // =========================================================================
    heading('9. Estimated Insurance Cost Range');
    body(
      `Illustrative annual ranges for a home valued around ${fmt(r.homeValue)}, ${r.deductiblePct}% hurricane deductible${
        r.mitigated ? ', with wind mitigation credits applied' : ''
      }${r.includeFlood ? '' : ', flood policy excluded'}. Homeowners and flood are separate policies. This is a screening range, not a formal binding quote.`
    );
    ensureRoom(48);
    datum('HOMEOWNERS (INCL. WIND)', fmt(homeLo) + ' - ' + fmt(homeHi), marginX);
    datum('FLOOD (NFIP-STYLE)', r.includeFlood ? fmt(floodLo) + ' - ' + fmt(floodHi) : 'Not included', marginX + 220);
    y += 38;

    // Combined Card Box
    ensureRoom(36);
    doc.setFillColor(248, 249, 242);
    doc.setDrawColor(24, 33, 41);
    doc.setLineWidth(1.2);
    doc.rect(marginX, y, pageW - marginX * 2, 28, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(76, 90, 98);
    doc.text('COMBINED ESTIMATED ANNUAL PREMIUM RANGE', marginX + 10, y + 11);
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(24, 33, 41);
    doc.text(
      fmt(homeLo + floodLo) + ' – ' + fmt(homeHi + floodHi) + ' / yr' + (r.includeFlood ? '' : ' (homeowners only)'),
      marginX + 10,
      y + 22
    );
    y += 34;

    if (!r.includeFlood && !r.floodErr && r.zoneInfo.risk >= 4) {
      ensureRoom(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(150, 56, 42);
      const noteTxt = doc.splitTextToSize(
        `Note: This property sits in a high-risk flood zone (${r.zoneKey}). Lenders typically mandate flood insurance for federally backed mortgages.`,
        pageW - marginX * 2
      );
      doc.text(noteTxt, marginX, y);
      y += noteTxt.length * 10 + 6;
    }
    rule();

    // Disclaimer footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 140);
    const disc =
      'Screening tool for early diligence, not a substitute for a flood elevation certificate, wind mitigation inspection, geotechnical sinkhole investigation, or licensed insurance quote.';
    const discLines = doc.splitTextToSize(disc, pageW - marginX * 2);
    ensureRoom(discLines.length * 10);
    doc.text(discLines, marginX, y);

    const fname = 'hazard-report-' + (r.county || r.stateAbbr || 'property').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf';
    doc.save(fname);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Download PDF report';
    }
  }
}

// Window global bindings for inline onclicks in HTML
(window as any).runReport = runReport;
(window as any).resetSearch = resetSearch;
(window as any).downloadPDF = downloadPDF;
(window as any).setSinkholeZoom = setSinkholeZoom;
(window as any).toggleSinkholeBasemap = toggleSinkholeBasemap;
(window as any).selectSinkholeFromTable = selectSinkholeFromTable;
(window as any).highlightSinkholeInList = highlightSinkholeInList;

// DOM ready initialization
document.addEventListener('DOMContentLoaded', () => {
  const addrInput = document.getElementById('address-input');
  if (addrInput) {
    addrInput.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') runReport();
    });
  }
  const incFlood = document.getElementById('include-flood');
  if (incFlood) {
    incFlood.addEventListener('change', () => {
      floodManuallySet = true;
    });
  }
});
