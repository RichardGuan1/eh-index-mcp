import { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "./server/backend.js";
import { VERSION } from "./version.js";
import { registerPrompts } from "./server/prompts.js";
import { registerSearchTools } from "./server/tools/search.js";
import { registerGalleryTools } from "./server/tools/gallery.js";
import { registerVersionTools } from "./server/tools/versions.js";
import { registerDiagnosticTools } from "./server/tools/diagnostics.js";
import { registerPageTools } from "./server/tools/pages.js";
import { registerAccountTools } from "./server/tools/account.js";
import { registerTagTools } from "./server/tools/tags.js";

export function createServer(backend: EhBackend): McpServer {
  const server = new McpServer({ name: "eh-index-mcp", version: VERSION });

  registerSearchTools(server, backend);

  registerGalleryTools(server, backend);

  registerVersionTools(server, backend);

  registerDiagnosticTools(server, backend);

  registerPageTools(server, backend);

  registerAccountTools(server, backend);
  registerTagTools(server, backend);

  registerPrompts(server);

  return server;
}
