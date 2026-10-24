export interface InstitutionPolygon {
  id: string;
  name: string;
  category?: string;
  coordinates: [number, number][]; // GeoJSON format: [[lng, lat], ...]
  area_m2?: number;
  notes?: string;
}

export interface CustomVariable {
  key: string;
  label: string;
  value: string;
}

export interface ChildPointItem {
  id?: number | string;
  institutionId?: string;
  polygonId?: string;
  polygonName?: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  customVariables?: Record<string, string> | CustomVariable[];
  notes?: string;
}

export const POLYGON_PALETTE = [
  "#059669", // Emerald
  "#2563eb", // Blue
  "#7c3aed", // Purple
  "#ea580c", // Orange
  "#0891b2", // Cyan
  "#d97706", // Amber
];

export const CHILD_CATEGORY_COLORS: Record<string, string> = {
  perkantoran: "#6366f1",
  pendidikan: "#059669",
  ibadah: "#7c3aed",
  asrama: "#be185d",
  olahraga: "#0891b2",
  laboratorium: "#0284c7",
  umum: "#4b5563",
};

/**
 * Calculates spherical polygon area in square meters.
 * LatLngs expected in [latitude, longitude] order.
 */
export function calculateAreaM2(latLngs: [number, number][]): number {
  if (!latLngs || latLngs.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  const len = latLngs.length;
  for (let i = 0; i < len; i++) {
    const p1 = latLngs[i];
    const p2 = latLngs[(i + 1) % len];
    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lng1 = (p1[1] * Math.PI) / 180;
    const lng2 = (p2[1] * Math.PI) / 180;
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * R * R) / 2.0);
  return Math.round(area);
}

/**
 * Converts GeoJSON [[lng, lat], ...] into Leaflet [[lat, lng], ...]
 */
export function toLeafletLatLngs(geoJsonCoords: [number, number][]): [number, number][] {
  if (!Array.isArray(geoJsonCoords)) return [];
  return geoJsonCoords
    .filter((pt) => Array.isArray(pt) && pt.length >= 2)
    .map((pt) => [pt[1], pt[0]] as [number, number]);
}

/**
 * Converts Leaflet [[lat, lng], ...] into GeoJSON [[lng, lat], ...]
 */
export function toGeoJsonCoords(leafletLatLngs: [number, number][]): [number, number][] {
  if (!Array.isArray(leafletLatLngs)) return [];
  return leafletLatLngs
    .filter((pt) => Array.isArray(pt) && pt.length >= 2)
    .map((pt) => [pt[1], pt[0]] as [number, number]);
}

/**
 * Normalizes any stored landGeometry into a clean list of InstitutionPolygon.
 * Supports:
 * - Single polygon array: [[lng, lat], ...]
 * - Array of polygon objects: [{ id, name, coordinates, ... }, ...]
 * - GeoJSON Polygon / MultiPolygon
 */
export function normalizePolygons(geom: any, defaultName = "Bidang Utama"): InstitutionPolygon[] {
  if (!geom) return [];

  // If string, try parse JSON
  if (typeof geom === "string") {
    try {
      geom = JSON.parse(geom);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(geom)) {
    // GeoJSON Feature or Polygon object
    if (geom?.type === "Polygon" && Array.isArray(geom.coordinates?.[0])) {
      const coords = geom.coordinates[0];
      const area = calculateAreaM2(toLeafletLatLngs(coords));
      return [
        {
          id: "poly-1",
          name: defaultName,
          coordinates: coords,
          area_m2: area,
        },
      ];
    }
    return [];
  }

  if (geom.length === 0) return [];

  // Case 1: Array of Polygon Objects [{ id, name, coordinates, ... }]
  if (typeof geom[0] === "object" && !Array.isArray(geom[0]) && geom[0]?.coordinates) {
    return geom
      .filter((p: any) => p && Array.isArray(p.coordinates) && p.coordinates.length >= 3)
      .map((p: any, idx: number) => {
        const coords = p.coordinates;
        const area = p.area_m2 || calculateAreaM2(toLeafletLatLngs(coords));
        return {
          id: String(p.id || `poly-${idx + 1}`),
          name: p.name || `Bidang ${idx + 1}`,
          category: p.category || "kampus",
          coordinates: coords,
          area_m2: area,
          notes: p.notes || "",
        };
      });
  }

  // Case 2: Array of points [[lng, lat], [lng, lat], ...] (Classic Single Polygon)
  if (Array.isArray(geom[0]) && typeof geom[0][0] === "number") {
    if (geom.length >= 3) {
      const area = calculateAreaM2(toLeafletLatLngs(geom));
      return [
        {
          id: "poly-1",
          name: defaultName,
          category: "kampus_utama",
          coordinates: geom,
          area_m2: area,
        },
      ];
    }
    return [];
  }

  return [];
}

/**
 * Ray-casting algorithm to test if a point is inside a polygon.
 * point: [lat, lng]
 * polygonLatLngs: array of [lat, lng]
 */
export function isPointInPolygon(
  point: [number, number],
  polygonLatLngs: [number, number][]
): boolean {
  if (!polygonLatLngs || polygonLatLngs.length < 3) return false;
  const [py, px] = point; // py = lat, px = lng
  let inside = false;
  const len = polygonLatLngs.length;

  for (let i = 0, j = len - 1; i < len; j = i++) {
    const [iy, ix] = polygonLatLngs[i];
    const [jy, jx] = polygonLatLngs[j];

    const intersect =
      iy > py !== jy > py && px < ((jx - ix) * (py - iy)) / (jy - iy) + ix;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks if a point [lat, lng] is inside ANY polygon of the institution.
 */
export function isPointInAnyPolygon(
  point: [number, number],
  polygons: InstitutionPolygon[]
): { inside: boolean; matchingPolygon?: InstitutionPolygon } {
  if (!polygons || polygons.length === 0) return { inside: false };

  for (const poly of polygons) {
    const latLngs = toLeafletLatLngs(poly.coordinates);
    if (isPointInPolygon(point, latLngs)) {
      return { inside: true, matchingPolygon: poly };
    }
  }

  return { inside: false };
}
