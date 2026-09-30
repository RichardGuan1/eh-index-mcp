import { describe, expect, it } from "vitest";
import { EhError, ehErrorFromUnknown } from "../src/errors.js";

describe("typed errors", () => {
  it("serializes a typed rate-limit error without exposing implementation details", () => {
    const error = new EhError("RATE_LIMITED", "E-Hentai rate limit reached", {
      retryable: true,
      site: "exhentai",
      stage: "gallery-search",
      status: 429,
    });

    expect(error.toJSON()).toEqual({
      code: "RATE_LIMITED",
      message: "E-Hentai rate limit reached",
      retryable: true,
      site: "exhentai",
      stage: "gallery-search",
      status: 429,
    });
  });

  it("classifies legacy authentication and challenge messages", () => {
    expect(ehErrorFromUnknown(new Error("E-Hentai returned a login page; credentials expired or were rejected")).toJSON())
      .toMatchObject({ code: "AUTH_REJECTED", retryable: false });
    expect(ehErrorFromUnknown(new Error("E-Hentai returned a Cloudflare challenge page")).toJSON())
      .toMatchObject({ code: "CLOUDFLARE_CHALLENGE", retryable: false });
  });
});