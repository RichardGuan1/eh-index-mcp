import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

const root = process.cwd();
const work = await mkdtemp(join(tmpdir(), "eh-index-mcp-pack-"));
const inherited = getDefaultEnvironment();
const expectedVersion = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version;
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run this script through npm run pack:smoke");
const runNpm = (args, options) => execFileSync(process.execPath, [npmCli, ...args], options);
let client;

try {
  const packed = JSON.parse(runNpm(["pack", "--json", "--pack-destination", work], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }));
  const packInfo = Array.isArray(packed) ? packed[0] : packed["eh-index-mcp"];
  if (!packInfo?.filename) throw new Error("npm pack did not return an archive filename");
  const archive = join(work, packInfo.filename);
  runNpm(["install", "--ignore-scripts", "--no-package-lock", archive], {
    cwd: work,
    env: { ...process.env, npm_config_loglevel: "error", npm_config_allow_scripts: "" },
    stdio: "pipe",
  });

  const packageJson = JSON.parse(await readFile(join(work, "node_modules", "eh-index-mcp", "package.json"), "utf8"));
  if (packageJson.version !== expectedVersion) {
    throw new Error(`Packed package version was ${packageJson.version}; expected ${expectedVersion}`);
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(work, "node_modules", "eh-index-mcp", packageJson.bin["eh-index-mcp"])],
    cwd: work,
    env: { ...inherited, EH_MEMBER_ID: "", EH_PASS_HASH: "", EH_IGNEOUS: "" },
    stderr: "pipe",
  });
  client = new Client({ name: "eh-index-mcp-pack-smoke", version: "1.0.0" });
  await client.connect(transport);
  const tools = await client.listTools();
  if (tools.tools.length !== 30) throw new Error(`Packed server exposed ${tools.tools.length} tools`);
  if (!tools.tools.every((tool) => tool.annotations?.readOnlyHint === true
    && tool.annotations.destructiveHint === false
    && tool.annotations.idempotentHint === true
    && tool.outputSchema)) {
    throw new Error("Packed server exposed an invalid read-only tool contract");
  }
  const prompts = await client.listPrompts();
  if (!prompts.prompts.some((prompt) => prompt.name === "eh_gallery_research")) {
    throw new Error("Packed server did not advertise the gallery research prompt");
  }
  const renderedPrompt = await client.getPrompt({
    name: "eh_gallery_research",
    arguments: { site: "exhentai", query: "language:chinese$", goal: "find matching galleries" },
  });
  const promptText = renderedPrompt.messages[0]?.content?.type === "text"
    ? renderedPrompt.messages[0].content.text
    : "";
  if (!promptText.includes("eh_search_galleries") || !promptText.includes("exhentai")) {
    throw new Error("Packed server rendered an invalid gallery research prompt");
  }

  const promptCases = [
    ["eh_gallery_compare", "eh_compare_gallery_versions", { site: "e-hentai", before: "1:old", after: "2:new", goal: "compare" }],
    ["eh_gallery_version_audit", "eh_get_gallery_chain", { site: "e-hentai", gallery: "1:token", goal: "audit" }],
    ["eh_tag_research", "eh_search_translated_tags", { site: "e-hentai", term: "中文标签", goal: "translate" }],
  ];
  for (const [name, tool, arguments_] of promptCases) {
    const rendered = await client.getPrompt({ name, arguments: arguments_ });
    const text = rendered.messages[0]?.content?.type === "text" ? rendered.messages[0].content.text : "";
    if (!text.includes(tool)) throw new Error(`Packed server rendered an invalid ${name} prompt`);
  }

  const query = await client.callTool({
    name: "eh_build_search_query",
    arguments: { includeTags: ["language:chinese"], exactTags: true },
  });
  if (query.isError || query.structuredContent?.result?.query !== "language:chinese$") {
    throw new Error("Packed server returned an invalid structured query result");
  }

  const access = await client.callTool({
    name: "eh_get_popular",
    arguments: { site: "exhentai" },
  });
  if (
    access.isError !== true
    || access.content?.[0]?.text !== "ExHentai requires EH_MEMBER_ID, EH_PASS_HASH, and EH_IGNEOUS credentials"
    || access.structuredContent?.error?.code !== "AUTH_REQUIRED"
    || access.structuredContent?.error?.site !== "exhentai"
  ) {
    throw new Error("Packed server returned an invalid structured authentication error");
  }
  console.log("pack smoke passed: stdio initialize/tools-list/tools-call, 30 read-only tools");
} finally {
  try {
    await client?.close();
  } finally {
    await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
