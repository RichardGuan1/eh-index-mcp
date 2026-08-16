import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

const required = ["EH_MEMBER_ID", "EH_PASS_HASH"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error("EH_MEMBER_ID and EH_PASS_HASH are required for the authenticated smoke test");
  process.exitCode = 1;
} else {
  const inherited = getDefaultEnvironment();
  const forwarded = Object.fromEntries(
    [
      "EH_MEMBER_ID",
      "EH_PASS_HASH",
      "EH_IGNEOUS",
      "EH_CF_CLEARANCE",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "NO_PROXY",
      "http_proxy",
      "https_proxy",
      "no_proxy",
    ].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    cwd: process.cwd(),
    env: { ...inherited, ...forwarded, NODE_USE_ENV_PROXY: "1" },
    stderr: "pipe",
  });
  const client = new Client({ name: "eh-index-mcp-auth-smoke", version: "1.0.0" });

  const resultValue = (result, label) => {
    if (result.isError) {
      const message = result.content?.map((item) => item.text ?? "").join("\n") || "unknown error";
      throw new Error(`${label}: ${message}`);
    }
    return result.structuredContent?.result;
  };

  try {
    await client.connect(transport);
    const access = resultValue(await client.callTool({
      name: "eh_check_access",
      arguments: { site: "e-hentai" },
    }), "E-Hentai access");
    if (access?.authenticated !== true) throw new Error("E-Hentai authenticated access was not confirmed");

    const categories = resultValue(await client.callTool({
      name: "eh_get_favorite_categories",
      arguments: { site: "e-hentai" },
    }), "favorite categories");
    if (categories?.categories?.length !== 10) throw new Error("Expected ten favorite categories");

    const favorites = resultValue(await client.callTool({
      name: "eh_search_favorites",
      arguments: { site: "e-hentai", category: "all" },
    }), "favorite search");
    const gallery = favorites?.galleries?.[0];
    if (!gallery?.gid || !gallery?.token) throw new Error("Favorite search returned no gallery for read-only validation");
    const ref = { gid: gallery.gid, token: gallery.token };

    const detail = resultValue(await client.callTool({
      name: "eh_get_favorite_detail",
      arguments: { site: "e-hentai", gallery: ref },
    }), "favorite detail");
    if (detail?.favorited !== true) throw new Error("Favorite detail did not confirm existing favorite state");

    const archive = resultValue(await client.callTool({
      name: "eh_get_archive_options",
      arguments: { site: "e-hentai", gallery: ref },
    }), "archive options");
    if (!archive?.options?.length) throw new Error("Archive options were empty");

    let exhentaiAuthenticated = null;
    if (process.env.EH_IGNEOUS) {
      const exAccess = resultValue(await client.callTool({
        name: "eh_check_access",
        arguments: { site: "exhentai" },
      }), "ExHentai access");
      exhentaiAuthenticated = exAccess?.authenticated === true;
      if (!exhentaiAuthenticated) throw new Error("ExHentai authenticated access was not confirmed");
    }

    console.log(JSON.stringify({
      eHentaiAuthenticated: true,
      exHentaiAuthenticated: exhentaiAuthenticated,
      favoriteCategoryCount: categories.categories.length,
      favoriteResultCount: favorites.galleries.length,
      favoriteDetailConfirmed: detail.favorited,
      archiveOptionCount: archive.options.length,
      archiveKinds: [...new Set(archive.options.map((option) => option.kind))].sort(),
    }, null, 2));
  } finally {
    await client.close();
  }
}
