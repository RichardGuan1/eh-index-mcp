#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { EhClient } from "./client.js";
import { clientOptionsFromEnvironment } from "./config.js";
import { createServer } from "./server.js";

function environmentCookies() {
  return {
    memberId: process.env.EH_MEMBER_ID,
    passHash: process.env.EH_PASS_HASH,
    igneous: process.env.EH_IGNEOUS,
    cfClearance: process.env.EH_CF_CLEARANCE,
  };
}

const backend = new EhClient({
  ...clientOptionsFromEnvironment(process.env),
  cookies: environmentCookies(),
});

await serveStdio(() => createServer(backend));
