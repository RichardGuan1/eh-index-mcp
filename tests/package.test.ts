import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/version.js";

describe("package layout", () => {
  it("builds the executable at the path declared by package.json", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"], {
      cwd: root,
      stdio: "pipe",
    });
    expect(existsSync(new URL("../dist/index.js", import.meta.url))).toBe(true);
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(packageJson.name).toBe("eh-index-mcp");
    expect(packageJson.bin).toEqual({ "eh-index-mcp": "dist/index.js" });
    expect(packageJson.engines.node).toBe(">=20.3");
    expect(packageJson.author).toBe("Richard Guan");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/RichardGuan1/eh-index-mcp.git",
    });
    expect(packageJson.homepage).toBe("https://github.com/RichardGuan1/eh-index-mcp#readme");
    expect(packageJson.bugs).toEqual({ url: "https://github.com/RichardGuan1/eh-index-mcp/issues" });
    expect(packageJson.publishConfig).toEqual({ access: "public" });
    expect(packageJson.scripts["smoke:auth"]).toBe("npm run build && node scripts/auth-smoke.mjs");
    expect(packageJson.files).not.toContain("scripts");
    expect(packageJson.keywords).toEqual(expect.arrayContaining([
      "mcp",
      "model-context-protocol",
      "e-hentai",
      "exhentai",
      "read-only",
    ]));
    const license = readFileSync(new URL("../LICENSE", import.meta.url), "utf8");
    expect(license).toContain("Copyright (c) 2026 Richard Guan");
  });

  it("keeps public repository documentation free of machine-local paths and proxy endpoints", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

    expect(readme).not.toMatch(/\b[A-Za-z]:[\\/]/);
    expect(readme).not.toMatch(/\/(?:home|Users)\/[^<\s/]+/);
    expect(readme).not.toContain(["127.0.0.1", "7897"].join(":"));
  });

  it("keeps npm, runtime, lockfile, and MCP Registry metadata aligned", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
    const manifest = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const readmeZh = readFileSync(new URL("../README.zh-CN.md", import.meta.url), "utf8");

    expect(VERSION).toBe("0.1.1");
    expect(packageJson.version).toBe(VERSION);
    expect(packageJson.mcpName).toBe("io.github.RichardGuan1/eh-index-mcp");
    expect(lockfile.version).toBe(VERSION);
    expect(lockfile.packages[""].version).toBe(VERSION);
    expect(manifest.name).toBe(packageJson.mcpName);
    expect(manifest.version).toBe(VERSION);
    expect(manifest.packages).toEqual([expect.objectContaining({
      registryType: "npm",
      identifier: "eh-index-mcp",
      version: VERSION,
      transport: { type: "stdio" },
    })]);
    expect(readme).toContain("30 read-only tools");
    expect(readmeZh).toContain("30 个只读工具");
    expect(readme).toContain("eh_search_watched");
    expect(readmeZh).toContain("eh_search_watched");
    expect(readme).toContain("eh_search_galleries_batch");
    expect(readmeZh).toContain("eh_search_galleries_batch");
    expect(root).toBeTruthy();
  });
});
