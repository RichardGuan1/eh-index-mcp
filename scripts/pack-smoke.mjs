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
  const client = new Client({ name: "eh-index-mcp-pack-smoke", version: "1.0.0" });
  await client.connect(transport);
  const tools = await client.listTools();
  if (tools.tools.length !== 30) throw new Error(`Packed server exposed ${tools.tools.length} tools`);
  if (!tools.tools.every((tool) => tool.annotations?.readOnlyHint === true
    && tool.annotations.destructiveHint === false
    && tool.annotations.idempotentHint === true
    && tool.outputSchema)) {
    throw new Error("Packed server exposed an invalid read-only tool contract");
  }
  await client.close();
  console.log("pack smoke passed: stdio initialize/tools-list, 30 read-only tools");
} finally {
  await rm(work, { recursive: true, force: true });
}
