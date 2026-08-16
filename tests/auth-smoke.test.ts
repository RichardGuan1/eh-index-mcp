import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("authenticated smoke script", () => {
  it("fails before starting the MCP server when required credentials are missing", () => {
    const env = { ...process.env };
    delete env.EH_MEMBER_ID;
    delete env.EH_PASS_HASH;
    delete env.EH_IGNEOUS;

    const result = spawnSync(process.execPath, ["scripts/auth-smoke.mjs"], {
      cwd: root,
      env,
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("EH_MEMBER_ID and EH_PASS_HASH are required");
  });
});
