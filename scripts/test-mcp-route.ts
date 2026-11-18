import { GET, POST } from "../app/api/mcp/route";

async function runMcpRouteTests() {
  console.log("=== 1. Test GET /api/mcp (SSE stream) ===");
  const getReq = new Request("http://localhost:3000/api/mcp", {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
    },
  });
  const getRes = await GET(getReq);
  console.log("GET status:", getRes.status, "Content-Type:", getRes.headers.get("Content-Type"));
  if (getRes.status !== 200 || !getRes.headers.get("Content-Type")?.includes("text/event-stream")) {
    throw new Error("FAIL: GET /api/mcp tidak menghasilkan event-stream.");
  }
  console.log("PASS: GET /api/mcp sukses!");

  console.log("\n=== 2. Test POST /api/mcp (Initialize) ===");
  const initReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    }),
  });
  const initRes = await POST(initReq);
  const initText = await initRes.text();
  console.log("Initialize Response status:", initRes.status);
  console.log("Init response text:", initText.trim());
  if (!initText.includes("sis-lpi-next-mcp")) {
    throw new Error("FAIL: Initialize tidak mengembalikan nama server yang sesuai.");
  }
  console.log("PASS: Initialize sukses!");

  console.log("\n=== 3. Test POST /api/mcp (tools/list) ===");
  const listReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });
  const listRes = await POST(listReq);
  const listText = await listRes.text();
  console.log("Tools List response:", listText.slice(0, 200) + "...");
  const expectedTools = [
    "search_institutions",
    "get_institution_detail",
    "find_institution_by_name",
    "get_institution_stats",
    "get_about_info",
    "get_nearby_institutions",
    "get_institution_land_polygons",
    "get_provinces_summary",
  ];
  for (const t of expectedTools) {
    if (!listText.includes(t)) {
      throw new Error(`FAIL: Tool ${t} tidak ditemukan di tools/list.`);
    }
  }
  console.log("PASS: Ke-8 tools ditemukan di tools/list!");

  console.log("\n=== 4. Test POST /api/mcp (tools/call: get_institution_stats) ===");
  const callReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_institution_stats",
        arguments: {
          type: "pesantren",
          city: "Kota Malang",
        },
      },
    }),
  });
  const callRes = await POST(callReq);
  const callText = await callRes.text();
  console.log("Call result:", callText.trim());
  if (!callText.includes("totalInstitutions") || !callText.includes("67")) {
    throw new Error("FAIL: get_institution_stats tidak mengembalikan 67 pesantren.");
  }
  console.log("PASS: Tool get_institution_stats sukses!");

  console.log("\n=== 5. Test POST /api/mcp (tools/call: find_institution_by_name) ===");
  const callFindReq = new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "find_institution_by_name",
        arguments: {
          name: "UIN Malang",
        },
      },
    }),
  });
  const callFindRes = await POST(callFindReq);
  const callFindText = await callFindRes.text();
  console.log("Find result contains 01375:", callFindText.includes("01375"));
  console.log("Find result contains 94828:", callFindText.includes("94828"));
  if (!callFindText.includes("01375") || !callFindText.includes("94828")) {
    throw new Error("FAIL: find_institution_by_name gagal mengidentifikasi UIN Malang.");
  }
  console.log("PASS: Tool find_institution_by_name sukses!");

  console.log("\n=== SEMUA PENGUJIAN ROUTE HANDLER /api/mcp BERHASIL 100%! ===");
  process.exit(0);
}

runMcpRouteTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
