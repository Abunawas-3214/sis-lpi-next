"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/sidebar/Sidebar";
import DetailDrawer from "@/components/detail/DetailDrawer";
import StatsModal from "@/components/stats/StatsModal";
import SuggestEditModal from "@/components/modals/SuggestEditModal";
import FloatingHeader from "@/components/header/FloatingHeader";
import { Loader2 } from "lucide-react";

// Dynamically import Leaflet MapComponent with SSR disabled
const MapComponent = dynamic(
  () => import("@/components/map/MapComponent"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium tracking-wide text-zinc-300">
          Memuat GIS Map Engine...
        </p>
      </div>
    ),
  }
);

export default function Home() {
  const [items, setItems] = useState<any[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedAccreditation, setSelectedAccreditation] = useState("");

  const [visibleLayers, setVisibleLayers] = useState({
    pesantren: true,
    madrasah: true,
    universitas_islam: true,
    polygons: false,
  });

  // Modals
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestTarget, setSuggestTarget] = useState<any | null>(null);

  // Fetch Provinces
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/provinces", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProvinces(data);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Error loading provinces:", err);
      });
    return () => controller.abort();
  }, []);

  // Fetch Map Markers with Debounce + AbortController
  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedProvince) params.set("province", selectedProvince);
      if (selectedType) params.set("type", selectedType);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedLevel) params.set("level", selectedLevel);
      if (selectedAccreditation) params.set("accreditation", selectedAccreditation);

      fetch(`/api/institutions/map?${params.toString()}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) setItems(data);
        })
        .catch((err) => {
          // AbortError is expected when filter changes quickly — suppress it
          if (err.name !== "AbortError") {
            console.error("Error loading map items:", err);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    search,
    selectedProvince,
    selectedType,
    selectedStatus,
    selectedLevel,
    selectedAccreditation,
  ]);

  const handleToggleLayer = (layer: keyof typeof visibleLayers) => {
    setVisibleLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleOpenSuggestForInst = (inst: any) => {
    setSuggestTarget(inst);
    setIsSuggestModalOpen(true);
  };

  const handleOpenSuggestNew = () => {
    setSuggestTarget(null);
    setIsSuggestModalOpen(true);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900">
      {/* Floating Modern Header */}
      <FloatingHeader onOpenStatsModal={() => setIsStatsModalOpen(true)} />

      {/* Interactive Map */}
      <MapComponent
        items={items}
        selectedId={selectedId}
        onSelectItem={(id) => setSelectedId(id)}
        visibleLayers={visibleLayers}
      />

      {/* Floating Control Sidebar */}
      <Sidebar
        search={search}
        onSearchChange={setSearch}
        selectedProvince={selectedProvince}
        onProvinceChange={setSelectedProvince}
        provinces={provinces}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedLevel={selectedLevel}
        onLevelChange={setSelectedLevel}
        selectedAccreditation={selectedAccreditation}
        onAccreditationChange={setSelectedAccreditation}
        visibleLayers={visibleLayers}
        onToggleLayer={handleToggleLayer}
        onOpenSuggestModal={handleOpenSuggestNew}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
        totalFiltered={items.length}
      />

      {/* Slide-over Detail Drawer */}
      <DetailDrawer
        institutionId={selectedId}
        onClose={() => setSelectedId(null)}
        onOpenSuggestEdit={handleOpenSuggestForInst}
      />

      {/* Analytics Modal */}
      <StatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />

      {/* Suggest Edit & Register Modal */}
      <SuggestEditModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        targetInstitution={suggestTarget}
        provinces={provinces}
      />
    </main>
  );
}
