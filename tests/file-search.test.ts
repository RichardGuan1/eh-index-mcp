import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EhClient } from "../src/client.js";
import { SerialRateLimiter } from "../src/rate-limiter.js";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe("local file hash search", () => {
  it("hashes one explicitly provided absolute file and searches it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ehmcp-file-"));
    directories.push(directory);
    const path = join(directory, "image.bin");
    await writeFile(path, "abc");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      expect(new URL(String(url)).searchParams.get("f_shash")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
      return new Response("<html><p>No hits found</p></html>");
    });
    const client = new EhClient({ fetch: fetchMock as typeof fetch, searchLimiter: new SerialRateLimiter(0) });
    await expect(client.searchByFile(path)).resolves.toEqual({
      path: resolve(path),
      size: 3,
      sha1: "a9993e364706816aba3e25717850c26c9cd0d89d",
      result: { galleries: [], prev: null, next: null },
    });
  });

  it("rejects relative paths, directories, and oversized files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ehmcp-file-"));
    directories.push(directory);
    const nested = join(directory, "nested");
    await mkdir(nested);
    const path = join(directory, "large.bin");
    await writeFile(path, Buffer.alloc(5));
    const client = new EhClient({ fetch: vi.fn() as typeof fetch, maxLocalFileBytes: 4 });
    await expect(client.searchByFile("relative.bin")).rejects.toThrow("absolute path");
    await expect(client.searchByFile(nested)).rejects.toThrow("regular file");
    await expect(client.searchByFile(path)).rejects.toThrow("exceeds");
  });
});
