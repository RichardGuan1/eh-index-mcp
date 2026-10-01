import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/server";
import type { EhBackend } from "../backend.js";
import { toolError, success } from "../helpers.js";
import { accessOutputSchema, siteInput } from "../schemas.js";

export function registerDiagnosticTools(server: McpServer, backend: EhBackend): void {
  server.registerTool(
    "eh_check_access",
    {
      title: "Check E-Hentai access",
      description: "Diagnose reachability, authentication state, and Cloudflare challenge state for E-Hentai or ExHentai.",
      inputSchema: z.object({ site: siteInput }),
      outputSchema: accessOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ site }) => {
      try {
        return success("result", await backend.checkAccess(site));
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
