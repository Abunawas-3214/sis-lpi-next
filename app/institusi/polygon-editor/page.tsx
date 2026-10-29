"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function PolygonEditorRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitId = searchParams.get("id");
  const targetPolyId = searchParams.get("polyId");

  useEffect(() => {
    const idParam = explicitId ? `?id=${explicitId}` : "";
    if (targetPolyId) {
      router.replace(`/polygon-editor/edit/${encodeURIComponent(targetPolyId)}${idParam}`);
    } else {
      router.replace(`/polygon-editor/tambah${idParam}`);
    }
  }, [explicitId, targetPolyId, router]);

  return (
    <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-sm">Mengarahkan ke editor polygon dinamis...</p>
    </div>
  );
}

export default function PolygonEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm">Memuat editor...</p>
        </div>
      }
    >
      <PolygonEditorRedirect />
    </Suspense>
  );
}
