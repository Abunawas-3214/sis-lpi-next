import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SEARCH_ALIASES: Record<string, string[]> = {
  uin: ["universitas islam negeri"],
  iain: ["institut agama islam negeri"],
  stain: ["sekolah tinggi agama islam negeri"],
  stai: ["sekolah tinggi agama islam"],
  staim: ["sekolah tinggi agama islam muhammadiyah"],
  stais: ["sekolah tinggi agama islam swasta"],
  ptkin: ["perguruan tinggi keagamaan islam negeri"],
  ma: ["madrasah aliyah"],
  man: ["madrasah aliyah negeri"],
  mts: ["madrasah tsanawiyah"],
  mtsn: ["madrasah tsanawiyah negeri"],
  mi: ["madrasah ibtidaiyah"],
  min: ["madrasah ibtidaiyah negeri"],
  ponpes: ["pondok pesantren"],
  pp: ["pondok pesantren"],
};

export const TYPE_LABELS: Record<string, string> = {
  pesantren: "Pondok Pesantren",
  madrasah: "Madrasah",
  universitas_islam: "Perguruan Tinggi Islam",
};

export const LEVEL_LABELS: Record<string, string> = {
  dasar: "Dasar (MI/SD)",
  menengah: "Menengah (MTs/SMP)",
  atas: "Atas (MA/SMA)",
  tinggi: "Tinggi (PTKI)",
  unknown: "—",
};

export const STATUS_LABELS: Record<string, string> = {
  negeri: "Negeri",
  swasta: "Swasta",
  unknown: "—",
};

export const PRECISION_LABELS: Record<string, string> = {
  exact: "Exact (OSM)",
  geocoded: "Geocoded",
  geocoded_fallback: "Kecamatan / Kota",
  city: "Tingkat Kota",
  polygon: "Batas Poligon",
};

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat("id-ID").format(num);
}

export function formatArea(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return String(val);
  return `${new Intl.NumberFormat("id-ID").format(num)} m²`;
}

export function formatCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return String(val);
  return `Rp ${new Intl.NumberFormat("id-ID").format(num)}`;
}
