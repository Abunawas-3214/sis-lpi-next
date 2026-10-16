"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { Navigation, Layers, Info, X } from "lucide-react";

export interface MapMarkerItem {
  id: string;
  name: string;
  type: string;
  level: string;
  status: string;
  province: string | null;
  city: string | null;
  coordinates: [number, number] | null;
  coordinate_precision: string | null;
  accreditation: string | null;
  has_polygon: boolean;
  has_parcels: boolean;
}

interface MapComponentProps {
  items: MapMarkerItem[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  visibleLayers: {
    pesantren: boolean;
    madrasah: boolean;
    universitas_islam: boolean;
    polygons: boolean;
  };
}

const BASEMAP_TILES = {
  streets: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
  },
  light: {
    name: "Carto Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  satellite: {
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri World Imagery",
    maxZoom: 18,
  },
  dark: {
    name: "Carto Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
};

const PARCEL_COLORS: Record<string, string> = {
  pendidikan: "#059669",
  ibadah: "#7c3aed",
  olahraga: "#0891b2",
  perkantoran: "#6366f1",
  infrastruktur: "#78716c",
  ekonomi: "#d97706",
  asrama: "#be185d",
  pertanian: "#65a30d",
  kesehatan: "#dc2626",
  akomodasi: "#ea580c",
  kebudayaan: "#9333ea",
  lahan_kosong: "#a8a29e",
  lainnya: "#a8a29e",
};

const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  pesantren: { bg: "#2563eb", border: "#ffffff" },        // Biru (Blue)
  madrasah: { bg: "#eab308", border: "#ffffff" },         // Kuning (Yellow)
  universitas_islam: { bg: "#dc2626", border: "#ffffff" }, // Merah (Red)
};

export default function MapComponent({
  items,
  selectedId,
  onSelectItem,
  visibleLayers,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const parcelLayerRef = useRef<L.GeoJSON | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<keyof typeof BASEMAP_TILES>("streets");
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [renderedCount, setRenderedCount] = useState(0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center Indonesia [-2.5489, 118.0149]
    const map = L.map(mapContainerRef.current, {
      center: [-2.5489, 118.0149],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Initial tile
    const tileConfig = BASEMAP_TILES[activeBasemap];
    const tile = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    currentTileLayerRef.current = tile;

    // Initialize Marker Cluster Group with custom green circle styling like the user requested
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 45,
      disableClusteringAtZoom: 16,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let sizeClass = "marker-cluster-small";
        if (count >= 100) sizeClass = "marker-cluster-medium";
        if (count >= 1000) sizeClass = "marker-cluster-large";

        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster ${sizeClass}`,
          iconSize: L.point(40, 40),
        });
      },
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
    mapInstanceRef.current = map;

    // Ensure Leaflet fills the container and renders all tiles
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    // Load Polygon Boundaries & Parcels from API
    fetch("/api/institutions/polygons")
      .then((res) => res.json())
      .then((data) => {
        if (!mapInstanceRef.current) return;

        // 1. Boundary Layer
        if (data.boundaries && data.boundaries.features?.length > 0) {
          const boundaryLayer = L.geoJSON(data.boundaries, {
            style: (feature: any) => {
              const type = feature?.properties?.institution_type || "pesantren";
              const color = TYPE_COLORS[type]?.bg || "#059669";
              return {
                color,
                weight: 2,
                opacity: 0.85,
                fillColor: color,
                fillOpacity: 0.25,
              };
            },
            onEachFeature: (feature: any, layer: any) => {
              layer.on("click", () => {
                if (feature.properties?.id) {
                  onSelectItem(feature.properties.id);
                }
              });
              layer.bindTooltip(
                `<strong>${feature.properties?.name || "Batas Lahan"}</strong><br/><span class="text-[10px] text-zinc-500">Batas Bidang Tanah</span>`,
                { direction: "top", sticky: true }
              );
            },
          });

          boundaryLayerRef.current = boundaryLayer;
          if (visibleLayers.polygons) {
            boundaryLayer.addTo(mapInstanceRef.current);
          }
        }

        // 2. Sub-Parcels Layer
        if (data.parcels && data.parcels.features?.length > 0) {
          const parcelLayer = L.geoJSON(data.parcels, {
            style: (feature: any) => {
              const color =
                PARCEL_COLORS[feature?.properties?.category] || "#a8a29e";
              return {
                color,
                weight: 1.5,
                opacity: 0.9,
                fillColor: color,
                fillOpacity: 0.65,
              };
            },
            onEachFeature: (feature: any, layer: any) => {
              layer.on("click", () => {
                if (feature.properties?.id) {
                  onSelectItem(feature.properties.id);
                }
              });
              const area = feature.properties?.area_m2
                ? ` — ${Number(feature.properties.area_m2).toLocaleString()} m²`
                : "";
              layer.bindTooltip(
                `<strong>${feature.properties?.parcel_name}</strong><br/>${feature.properties?.category}${area}`,
                { direction: "top", sticky: true }
              );
            },
          });

          parcelLayerRef.current = parcelLayer;
          if (visibleLayers.polygons) {
            parcelLayer.addTo(mapInstanceRef.current);
          }
        }
      })
      .catch((err) => console.error("Error loading polygons:", err));

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Basemap tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const tileConfig = BASEMAP_TILES[activeBasemap];
    const newTile = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
    }).addTo(map);

    currentTileLayerRef.current = newTile;
  }, [activeBasemap]);

  // Toggle Polygon Layers on/off
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (boundaryLayerRef.current) {
      if (visibleLayers.polygons) {
        if (!map.hasLayer(boundaryLayerRef.current)) {
          map.addLayer(boundaryLayerRef.current);
        }
      } else {
        if (map.hasLayer(boundaryLayerRef.current)) {
          map.removeLayer(boundaryLayerRef.current);
        }
      }
    }

    if (parcelLayerRef.current) {
      if (visibleLayers.polygons) {
        if (!map.hasLayer(parcelLayerRef.current)) {
          map.addLayer(parcelLayerRef.current);
        }
      } else {
        if (map.hasLayer(parcelLayerRef.current)) {
          map.removeLayer(parcelLayerRef.current);
        }
      }
    }
  }, [visibleLayers.polygons]);

  // Update Markers inside Cluster Group when items or visibleLayers change
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    clusterGroup.clearLayers();

    // Filter items according to layer toggle
    const filtered = items.filter((item) => {
      if (!item.coordinates) return false;
      if (item.type === "pesantren" && !visibleLayers.pesantren) return false;
      if (item.type === "madrasah" && !visibleLayers.madrasah) return false;
      if (item.type === "universitas_islam" && !visibleLayers.universitas_islam)
        return false;
      return true;
    });

    setRenderedCount(filtered.length);

    const markersToAdd: L.Marker[] = [];

    filtered.forEach((item) => {
      if (!item.coordinates) return;
      const [lat, lng] = item.coordinates;
      const typeStyle = TYPE_COLORS[item.type] || {
        bg: "#059669",
        border: "#ffffff",
      };

      const isSelected = item.id === selectedId;

      // Custom DivIcon for crisp, circular pins
      const icon = L.divIcon({
        className: "custom-pin",
        html: `<div style="
          width: ${isSelected ? "14px" : "10px"};
          height: ${isSelected ? "14px" : "10px"};
          background-color: ${typeStyle.bg};
          border: 2px solid ${isSelected ? "#ffffff" : typeStyle.border};
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
        "></div>`,
        iconSize: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon });

      // Tooltip preview
      marker.bindTooltip(
        `<div class="text-xs font-semibold py-0.5 px-1">${item.name}</div><div class="text-[10px] text-zinc-500">${item.city || item.province || ""}</div>`,
        { direction: "top", offset: [0, -8], opacity: 0.95 }
      );

      marker.on("click", () => {
        onSelectItem(item.id);
      });

      markersToAdd.push(marker);
    });

    clusterGroup.addLayers(markersToAdd);
  }, [items, visibleLayers, selectedId, onSelectItem]);

  // Focus map on selected item
  useEffect(() => {
    if (!selectedId || !mapInstanceRef.current) return;
    const found = items.find((i) => i.id === selectedId);
    if (found && found.coordinates) {
      mapInstanceRef.current.flyTo(found.coordinates, 16, {
        duration: 1.2,
      });
    }
  }, [selectedId, items]);

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-900 overflow-hidden">
      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Floating Basemap Selector & Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-400">
        {!isControlsOpen ? (
          <button
            onClick={() => setIsControlsOpen(true)}
            title="Buka Pengaturan Peta & Informasi"
            className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-zinc-200/80 hover:bg-zinc-50 text-zinc-800 transition-all text-xs font-semibold hover:shadow-2xl active:scale-95 group"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Peta & Info</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md shadow-xl border border-zinc-200/80 rounded-2xl p-1.5 transition-all">
            {/* Basemap Switcher */}
            <div className="flex items-center gap-1">
              {(Object.keys(BASEMAP_TILES) as Array<keyof typeof BASEMAP_TILES>).map((key) => {
                const active = activeBasemap === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveBasemap(key)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl font-medium transition-all ${
                      active
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    {BASEMAP_TILES[key].name}
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-[1px] bg-zinc-200 mx-0.5" />

            {/* Reset View Button */}
            <button
              onClick={() => {
                mapInstanceRef.current?.flyTo([-2.5489, 118.0149], 5, { duration: 1 });
              }}
              title="Pusatkan Peta ke Indonesia"
              className="p-2 text-zinc-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
            >
              <Navigation className="w-4 h-4" />
            </button>

            {/* About Page Link */}
            <a
              href="/about"
              title="Tentang Pengembangan SIS-LPI"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-semibold transition-all"
            >
              <Info className="w-4 h-4 text-emerald-600" />
              <span>About</span>
            </a>

            {/* Minimize Button */}
            <button
              onClick={() => setIsControlsOpen(false)}
              title="Minimize Pengaturan Peta"
              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all ml-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Floating Status Pill (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-400 bg-white/95 backdrop-blur-md border border-zinc-200 shadow-md rounded-full px-4 py-1.5 flex items-center gap-2.5 text-xs text-zinc-600">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-700"></span>
        </span>
        <span>
          Menampilkan <strong className="text-zinc-900 font-semibold">{renderedCount.toLocaleString()}</strong> titik lembaga (Cluster aktif)
        </span>
      </div>
    </div>
  );
}
