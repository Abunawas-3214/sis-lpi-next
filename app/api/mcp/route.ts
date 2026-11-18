import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";

async function handleMcpRequest(request: Request): Promise<Response> {
  // Verifikasi otentikasi opsional jika MCP_API_KEY disetel pada .env
  const configuredApiKey = process.env.MCP_API_KEY;
  if (configuredApiKey) {
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("x-mcp-api-key");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (token !== configuredApiKey) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32002,
            message: "Unauthorized: Invalid or missing MCP API Key",
          },
          id: null,
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }

  // Jika client tidak menyertakan Accept yang lengkap, lengkapi agar kompatibel dengan MCP SDK
  let req = request;
  const acceptHeader = request.headers.get("accept") || "";
  if (
    request.method === "POST" &&
    (!acceptHeader.includes("application/json") ||
      !acceptHeader.includes("text/event-stream"))
  ) {
    const headers = new Headers(request.headers);
    headers.set("accept", "application/json, text/event-stream");
    req = new Request(request, { headers });
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport();

  await server.connect(transport);
  const response = await transport.handleRequest(req);

  // Pastikan header CORS disematkan agar bisa diakses dari web/client lain
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, x-mcp-api-key");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Accept, Authorization, x-mcp-api-key",
    },
  });
}
