import { callMcpTool, getMcpConfig, MCP_TOOLS } from "@/lib/mcp";

/**
 * EdgePress MCP server (Streamable HTTP, JSON-RPC 2.0). Lets external agents
 * (Claude, etc.) manage the site as tools. Auth: Bearer token from the admin
 * MCP settings. This is the flagship "manage your site from chat" surface.
 */
const PROTOCOL_VERSION = "2025-06-18";

function rpc(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

export async function GET() {
  // Minimal discovery for clients that probe with GET.
  return Response.json({ name: "edgepress", version: "1.0.0", transport: "streamable-http" });
}

export async function POST(request: Request) {
  const cfg = await getMcpConfig();
  if (!cfg.enabled) return new Response("MCP is disabled", { status: 404 });

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim() || new URL(request.url).searchParams.get("token") || "";
  if (token !== cfg.token) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: unknown; method?: string; params?: Record<string, unknown> } | null;
  if (!body || typeof body.method !== "string") return rpcError(body?.id ?? null, -32600, "Invalid Request");

  const { id, method, params } = body;

  switch (method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "EdgePress", version: "1.0.0" },
        instructions: "Manage an EdgePress website: list/create/translate/publish pages and read CRM leads.",
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return new Response(null, { status: 202 });

    case "ping":
      return rpc(id, {});

    case "tools/list":
      return rpc(id, { tools: MCP_TOOLS });

    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      try {
        const result = await callMcpTool(name, args);
        return rpc(id, result);
      } catch (e) {
        return rpc(id, { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : "tool failed"}` }], isError: true });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
