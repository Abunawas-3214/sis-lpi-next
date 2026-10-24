"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Layers,
  MapPin,
  Trash2,
  CheckCircle,
  Plus,
  Navigation,
  RefreshCw,
  Maximize2,
  Info,
  Edit2,
  Crosshair,
  AlertCircle,
} from "lucide-react";
import {
  InstitutionPolygon,
  ChildPointItem,
  calculateAreaM2,
  toLeafletLatLngs,
  toGeoJsonCoords,
  POLYGON_PALETTE,
  CHILD_CATEGORY_COLORS,
  normalizePolygons,
  isPointInPolygon,
} from "@/lib/geometry";

interface PolygonMapEditorProps {
  initialCoordinates: [number, number] | null; // [lat, lng]
  polygons?: InstitutionPolygon[];
  initialPolygon?: [number, number][] | null; // Backward compatibility
  childPoints?: ChildPointItem[];
  onCoordinatesChange: (coords: [number, number]) => void;
  onPolygonsChange?: (polygons: InstitutionPolygon[], totalAreaM2: number) => void;
  onPolygonChange?: (polygon: [number, number][] | null, areaM2: number) => void; // Backward compatibility
  // Interactive point picker callback for child points:
  isPickingChildPoint?: boolean;
  onPickChildPoint?: (lat: number, lng: number, polygonId?: string, polygonName?: string) => void;
}

const BASEMAP_TILES = {
  streets: {
    name: "Jalan (OSM)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  satellite: {
    name: "Satelit (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 18,
    attribution: "&copy; Esri World Imagery",
  },
};

export default function PolygonMapEditor({
  initialCoordinates,
  polygons: propPolygons,
  initialPolygon,
  childPoints = [],
  onCoordinatesChange,
  onPolygonsChange,
  onPolygonChange,
  isPickingChildPoint = false,
  onPickChildPoint,
}: PolygonMapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);
  const markerLayerRef = useRef<L.Marker | null>(null);
  const polygonLayersRef = useRef<L.Polygon[]>([]);
  const vertexMarkersRef = useRef<L.CircleMarker[]>([]);
  const childMarkersRef = useRef<L.Marker[]>([]);

  const [activeBasemap, setActiveBasemap] =
    useState<keyof typeof BASEMAP_TILES>("streets");

  // State: List of Multi-Polygons
  const [polygons, setPolygons] = useState<InstitutionPolygon[]>(() => {
    if (propPolygons && Array.isArray(propPolygons) && propPolygons.length > 0) {
      return propPolygons;
    }
    if (initialPolygon && Array.isArray(initialPolygon) && initialPolygon.length > 2) {
      const area = calculateAreaM2(toLeafletLatLngs(initialPolygon));
      return [
        {
          id: "poly-1",
          name: "Bidang 1 (Utama)",
          coordinates: initialPolygon,
          area_m2: area,
        },
      ];
    }
    return [];
  });

  const [activePolyId, setActivePolyId] = useState<string>(() => {
    if (propPolygons && propPolygons.length > 0) return propPolygons[0].id;
    return "poly-1";
  });

  // Explicit edit mode toggle for polygons
  const [isEditingPolygon, setIsEditingPolygon] = useState(false);
  const [drawMode, setDrawMode] = useState<"polygon" | "point">("polygon");

  const [currentCoords, setCurrentCoords] = useState<[number, number]>(() => {
    return initialCoordinates || [-7.2575, 112.7521];
  });

  // Keep latest callbacks in refs to avoid triggering effects during render
  const onPolygonsChangeRef = useRef(onPolygonsChange);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  const onPickChildPointRef = useRef(onPickChildPoint);

  useEffect(() => {
    onPolygonsChangeRef.current = onPolygonsChange;
    onPolygonChangeRef.current = onPolygonChange;
    onCoordinatesChangeRef.current = onCoordinatesChange;
    onPickChildPointRef.current = onPickChildPoint;
  });

  // Sync propPolygons when props update asynchronously
  useEffect(() => {
    if (propPolygons && Array.isArray(propPolygons) && propPolygons.length > 0) {
      setPolygons(propPolygons);
      setActivePolyId((prev) => {
        if (!prev || !propPolygons.some((p) => p.id === prev)) {
          return propPolygons[0].id;
        }
        return prev;
      });
    }
  }, [propPolygons]);

  // Sync initialCoordinates when prop arrives
  useEffect(() => {
    if (
      initialCoordinates &&
      Array.isArray(initialCoordinates) &&
      initialCoordinates.length === 2 &&
      !isNaN(initialCoordinates[0]) &&
      !isNaN(initialCoordinates[1])
    ) {
      setCurrentCoords(initialCoordinates);
      if (markerLayerRef.current) {
        markerLayerRef.current.setLatLng(initialCoordinates);
      }
    }
  }, [initialCoordinates]);

  // Keep active polygon reference
  const activePolygon = polygons.find((p) => p.id === activePolyId);

  // Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (err) {}
      mapInstanceRef.current = null;
    }
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    let map: L.Map | null = null;
    try {
      map = L.map(container, {
        center: currentCoords,
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });

      const tileConfig = BASEMAP_TILES[activeBasemap];
      const initialTile = L.tileLayer(tileConfig.url, {
        maxZoom: tileConfig.maxZoom,
        attribution: tileConfig.attribution,
      }).addTo(map);

      currentTileLayerRef.current = initialTile;

      // Draggable center point marker
      const marker = L.marker(currentCoords, {
        draggable: true,
        icon: L.divIcon({
          className: "custom-div-icon",
          html: `<div style="background-color: #2563eb; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map);

      marker.bindTooltip("Titik Pusat Lembaga (Drag untuk memindahkan)", { sticky: true });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        const newCoords: [number, number] = [pos.lat, pos.lng];
        setCurrentCoords(newCoords);
        if (onCoordinatesChangeRef.current) {
          onCoordinatesChangeRef.current(newCoords);
        }
      });

      markerLayerRef.current = marker;
      mapInstanceRef.current = map;

      // Invalidate size on timers to ensure full render
      setTimeout(() => map?.invalidateSize(), 50);
      setTimeout(() => map?.invalidateSize(), 200);
      setTimeout(() => map?.invalidateSize(), 600);
    } catch (e) {
      console.error("Leaflet map initialization error:", e);
    }

    const resizeObserver = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
    };
  }, []);

  // Switch basemap
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }
    const tileConfig = BASEMAP_TILES[activeBasemap];
    const newTile = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(map);
    currentTileLayerRef.current = newTile;
  }, [activeBasemap]);

  // Handle map click for drawing polygon vertices, child point picking, or moving center
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;

      // 1. Child Point Picking Mode
      if (isPickingChildPoint) {
        // Find which polygon this click falls into (if any)
        let foundPoly: InstitutionPolygon | undefined;
        for (const poly of polygons) {
          const latLngs = toLeafletLatLngs(poly.coordinates);
          if (latLngs.length >= 3 && isPointInPolygon([clickLat, clickLng], latLngs)) {
            foundPoly = poly;
            break;
          }
        }

        if (onPickChildPointRef.current) {
          onPickChildPointRef.current(clickLat, clickLng, foundPoly?.id, foundPoly?.name);
        }
        return;
      }

      // 2. Main Institution Coordinate Mode
      if (drawMode === "point") {
        const newCoords: [number, number] = [clickLat, clickLng];
        setCurrentCoords(newCoords);
        if (markerLayerRef.current) {
          markerLayerRef.current.setLatLng(newCoords);
        }
        if (onCoordinatesChangeRef.current) {
          onCoordinatesChangeRef.current(newCoords);
        }
        return;
      }

      // 3. Polygon Drawing Mode - only active when user explicitly enables editing
      if (!isEditingPolygon) return;

      // Add point to active polygon
      const newPtGeoJson: [number, number] = [clickLng, clickLat];

      setPolygons((prev) => {
        const existing = prev.find((p) => p.id === activePolyId);
        let updated: InstitutionPolygon[];

        if (!existing) {
          const newPoly: InstitutionPolygon = {
            id: activePolyId || `poly-${prev.length + 1}`,
            name: `Bidang ${prev.length + 1}`,
            coordinates: [newPtGeoJson],
            area_m2: 0,
          };
          updated = [...prev, newPoly];
        } else {
          updated = prev.map((p) => {
            if (p.id !== activePolyId) return p;
            const newCoords = [...p.coordinates, newPtGeoJson];
            const area = calculateAreaM2(toLeafletLatLngs(newCoords));
            return {
              ...p,
              coordinates: newCoords,
              area_m2: area,
            };
          });
        }

        const totalArea = updated.reduce((acc, p) => acc + (p.area_m2 || 0), 0);
        if (onPolygonsChangeRef.current) {
          onPolygonsChangeRef.current(updated, totalArea);
        }
        if (onPolygonChangeRef.current) {
          onPolygonChangeRef.current(updated[0]?.coordinates || null, updated[0]?.area_m2 || 0);
        }

        return updated;
      });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [isEditingPolygon, drawMode, activePolyId, isPickingChildPoint, polygons]);

  // Render Polygons, Vertices, and Child Points
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing polygon layers and vertex markers
    polygonLayersRef.current.forEach((l) => map.removeLayer(l));
    polygonLayersRef.current = [];
    vertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    vertexMarkersRef.current = [];

    let hasBounds = false;
    const bounds = L.latLngBounds([currentCoords, currentCoords]);

    polygons.forEach((poly, polyIdx) => {
      const latLngs = toLeafletLatLngs(poly.coordinates);
      const isActive = poly.id === activePolyId;
      const color = POLYGON_PALETTE[polyIdx % POLYGON_PALETTE.length];

      if (latLngs.length >= 3) {
        const polygonLayer = L.polygon(latLngs, {
          color: isActive ? "#047857" : color,
          weight: isActive ? 3 : 2,
          fillColor: color,
          fillOpacity: isActive ? 0.35 : 0.2,
          dashArray: isActive ? undefined : "4, 4",
        }).addTo(map);

        polygonLayer.bindTooltip(
          `<strong>${poly.name}</strong><br/>${poly.area_m2 ? `${poly.area_m2.toLocaleString()} m²` : ""}`,
          { sticky: true }
        );

        polygonLayer.on("click", (e) => {
          // If in child point picking mode, allow click to set coordinate
          if (isPickingChildPoint) {
            L.DomEvent.stopPropagation(e);
            if (onPickChildPointRef.current) {
              onPickChildPointRef.current(e.latlng.lat, e.latlng.lng, poly.id, poly.name);
            }
            return;
          }

          setActivePolyId(poly.id);
        });

        polygonLayersRef.current.push(polygonLayer);
        bounds.extend(polygonLayer.getBounds());
        hasBounds = true;

        // Draw editable vertex markers ONLY when edit mode is actively turned ON
        if (isActive && isEditingPolygon) {
          latLngs.forEach((pt, vertexIdx) => {
            const vertex = L.circleMarker(pt, {
              radius: 6,
              color: "#047857",
              weight: 2,
              fillColor: "#ffffff",
              fillOpacity: 1,
            }).addTo(map);

            vertex.bindTooltip(`Titik ${vertexIdx + 1} (Klik untuk hapus vertex)`, {
              sticky: true,
            });

            vertex.on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              // Remove this vertex
              setPolygons((prev) => {
                const nextPolys = prev.map((p) => {
                  if (p.id !== poly.id) return p;
                  const newCoords = p.coordinates.filter((_, i) => i !== vertexIdx);
                  const area = calculateAreaM2(toLeafletLatLngs(newCoords));
                  return { ...p, coordinates: newCoords, area_m2: area };
                });
                const totalArea = nextPolys.reduce((acc, p) => acc + (p.area_m2 || 0), 0);
                if (onPolygonsChangeRef.current) {
                  onPolygonsChangeRef.current(nextPolys, totalArea);
                }
                if (onPolygonChangeRef.current) {
                  onPolygonChangeRef.current(nextPolys[0]?.coordinates || null, nextPolys[0]?.area_m2 || 0);
                }
                return nextPolys;
              });
            });

            vertexMarkersRef.current.push(vertex);
          });
        }
      } else if (latLngs.length > 0) {
        // Line preview
        const polyline = L.polyline(latLngs, {
          color: "#047857",
          weight: 2,
          dashArray: "4, 4",
        }).addTo(map);
        polygonLayersRef.current.push(polyline as any);

        latLngs.forEach((pt) => {
          const vertex = L.circleMarker(pt, {
            radius: 5,
            color: "#047857",
            weight: 2,
            fillColor: "#ffffff",
            fillOpacity: 1,
          }).addTo(map);
          vertexMarkersRef.current.push(vertex);
        });
      }
    });

    // Render Child Points
    childMarkersRef.current.forEach((m) => map.removeLayer(m));
    childMarkersRef.current = [];

    childPoints.forEach((cp) => {
      if (!cp.latitude || !cp.longitude) return;
      const catColor = CHILD_CATEGORY_COLORS[cp.category?.toLowerCase()] || "#7c3aed";

      const childIcon = L.divIcon({
        className: "child-point-editor-pin",
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            background-color: ${catColor};
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            font-size: 9px;
            font-weight: bold;
          ">
            📍
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const childMarker = L.marker([cp.latitude, cp.longitude], {
        icon: childIcon,
      }).addTo(map);

      childMarker.bindTooltip(
        `<strong>${cp.name}</strong><br/><span style="text-transform: capitalize; font-size: 10px; color: ${catColor};">${cp.category}</span>`,
        { direction: "top", offset: [0, -10] }
      );

      childMarkersRef.current.push(childMarker);
      bounds.extend([cp.latitude, cp.longitude]);
      hasBounds = true;
    });

    // Initial fit bounds if spatial elements exist
    if (hasBounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    } else if (currentCoords) {
      map.setView(currentCoords, 16);
    }

    setTimeout(() => map?.invalidateSize(), 100);
  }, [polygons, activePolyId, isEditingPolygon, childPoints, isPickingChildPoint]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let hasBounds = false;
    const bounds = L.latLngBounds([currentCoords, currentCoords]);

    polygons.forEach((poly) => {
      const latLngs = toLeafletLatLngs(poly.coordinates);
      if (latLngs.length >= 3) {
        bounds.extend(latLngs);
        hasBounds = true;
      }
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    } else {
      map.setView(currentCoords, 16);
    }
  };

  const handleAddNewPolygon = () => {
    const nextIdx = polygons.length + 1;
    const newId = `poly-${Date.now()}`;
    const newPoly: InstitutionPolygon = {
      id: newId,
      name: `Bidang ${nextIdx}`,
      coordinates: [],
      area_m2: 0,
    };
    const nextList = [...polygons, newPoly];
    setPolygons(nextList);
    setActivePolyId(newId);
    setIsEditingPolygon(true);
    setDrawMode("polygon");

    const totalArea = nextList.reduce((acc, p) => acc + (p.area_m2 || 0), 0);
    if (onPolygonsChangeRef.current) {
      onPolygonsChangeRef.current(nextList, totalArea);
    }
  };

  const handleDeleteActivePolygon = () => {
    if (!activePolygon) return;
    if (!confirm(`Hapus polygon "${activePolygon.name}"?`)) return;

    const remaining = polygons.filter((p) => p.id !== activePolyId);
    setPolygons(remaining);
    setActivePolyId(remaining[0]?.id || "poly-1");
    setIsEditingPolygon(false);

    const totalArea = remaining.reduce((acc, p) => acc + (p.area_m2 || 0), 0);
    if (onPolygonsChangeRef.current) onPolygonsChangeRef.current(remaining, totalArea);
    if (onPolygonChangeRef.current) onPolygonChangeRef.current(remaining[0]?.coordinates || null, remaining[0]?.area_m2 || 0);
  };

  const handleUpdatePolygonName = (newName: string) => {
    const nextList = polygons.map((p) =>
      p.id === activePolyId ? { ...p, name: newName } : p
    );
    setPolygons(nextList);
    const totalArea = nextList.reduce((acc, p) => acc + (p.area_m2 || 0), 0);
    if (onPolygonsChangeRef.current) onPolygonsChangeRef.current(nextList, totalArea);
  };

  const totalCalculatedArea = polygons.reduce((acc, p) => acc + (p.area_m2 || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Mulai / Selesai Edit Polygon (Permintaan User: Ada tombol dulu sebelum user mengedit polygon) */}
          <button
            type="button"
            onClick={() => {
              setIsEditingPolygon((prev) => !prev);
              setDrawMode("polygon");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              isEditingPolygon
                ? "bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-500/30"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isEditingPolygon ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Selesai Edit Polygon</span>
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                <span>Mulai Edit / Gambar Polygon</span>
              </>
            )}
          </button>

          {/* Mode switch */}
          <div className="flex bg-white rounded-xl p-1 border border-zinc-200 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => {
                setDrawMode("polygon");
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                drawMode === "polygon"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bidang Polygon ({polygons.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawMode("point");
                setIsEditingPolygon(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                drawMode === "point"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Titik Pusat</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddNewPolygon}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Tambah Bidang Baru</span>
          </button>
        </div>

        {/* Basemap switch & Area info */}
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-xl p-1 border border-zinc-200 text-xs shadow-xs">
            {(Object.keys(BASEMAP_TILES) as Array<keyof typeof BASEMAP_TILES>).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveBasemap(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeBasemap === key
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {BASEMAP_TILES[key].name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRecenter}
            title="Pusatkan Peta ke Bidang Polygon"
            className="p-2 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-700 shadow-xs transition-colors"
          >
            <Navigation className="w-4 h-4 text-emerald-600" />
          </button>
        </div>
      </div>

      {/* Picking child point alert banner */}
      {isPickingChildPoint && (
        <div className="p-3 bg-purple-100 border border-purple-300 rounded-xl flex items-center justify-between text-xs text-purple-900 font-medium animate-pulse">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-purple-700" />
            <span>
              <strong>Mode Klik Peta Aktif:</strong> Silakan klik di atas area polygon untuk menentukan posisi titik fasilitas.
            </span>
          </div>
        </div>
      )}

      {/* Multi-Polygon Selector Tabs */}
      {polygons.length > 0 && (
        <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Daftar Bidang Polygon Lembaga (Pilih untuk diedit)</span>
            </span>
            <span className="font-bold text-emerald-800">
              Total Luas: {totalCalculatedArea.toLocaleString("id-ID")} m² ({(totalCalculatedArea / 10000).toFixed(2)} Ha)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {polygons.map((poly, idx) => {
              const isActive = poly.id === activePolyId;
              const color = POLYGON_PALETTE[idx % POLYGON_PALETTE.length];
              return (
                <button
                  key={poly.id}
                  type="button"
                  onClick={() => {
                    setActivePolyId(poly.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                    isActive
                      ? "bg-white text-zinc-900 shadow-sm border-emerald-500 ring-2 ring-emerald-500/20"
                      : "bg-white/60 text-zinc-600 border-zinc-200 hover:bg-white"
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>{poly.name}</span>
                  {poly.area_m2 ? (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      ({poly.area_m2.toLocaleString()} m²)
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Active Polygon Controls */}
          {activePolygon && (
            <div className="pt-2 border-t border-zinc-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <span className="text-zinc-500 shrink-0">Nama Bidang:</span>
                <input
                  type="text"
                  value={activePolygon.name}
                  onChange={(e) => handleUpdatePolygonName(e.target.value)}
                  placeholder="Misal: Kampus 1, Asrama Putra"
                  className="px-2.5 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-800 flex-1 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">
                  {activePolygon.coordinates.length} titik vertex
                </span>
                <button
                  type="button"
                  onClick={handleDeleteActivePolygon}
                  className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Bidang Ini</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map Canvas */}
      <div className="relative w-full h-[480px] min-h-[480px] rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-inner">
        <div
          ref={mapContainerRef}
          style={{ height: "480px", width: "100%", minHeight: "480px" }}
          className={`w-full h-full ${isPickingChildPoint ? "cursor-crosshair" : ""}`}
        />

        {/* Guidance Overlay */}
        <div className="absolute top-3 left-3 z-400 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-zinc-200 shadow-md text-xs space-y-0.5 max-w-xs pointer-events-none">
          <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            <span>Panduan Mode Peta</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-tight">
            {isPickingChildPoint
              ? "Klik pada peta (di dalam polygon) untuk mengisi koordinat titik fasilitas."
              : isEditingPolygon
              ? "Mode Edit Aktif: Klik pada peta untuk menambah titik sudut polygon. Klik pada titik putih untuk menghapusnya."
              : drawMode === "point"
              ? "Geser (drag) titik biru untuk memposisikan koordinat utama lembaga."
              : "Klik tombol 'Mulai Edit / Gambar Polygon' di atas jika Anda ingin mengubah sudut bidang tanah."}
          </p>
        </div>
      </div>
    </div>
  );
}
