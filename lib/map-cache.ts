// In-memory cache for map data to ensure instant navigation between pages
export interface MapCacheData {
  items: any[] | null;
  polygons: any | null;
  provinces: string[] | null;
}

const memoryCache: MapCacheData = {
  items: null,
  polygons: null,
  provinces: null,
};

export function getDefaultMapCache(): any[] | null {
  return memoryCache.items;
}

export function setDefaultMapCache(items: any[]): void {
  memoryCache.items = items;
}

export function getPolygonsCache(): any | null {
  return memoryCache.polygons;
}

export function setPolygonsCache(data: any): void {
  memoryCache.polygons = data;
}

export function getProvincesCache(): string[] | null {
  return memoryCache.provinces;
}

export function setProvincesCache(provinces: string[]): void {
  memoryCache.provinces = provinces;
}
