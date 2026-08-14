import type { Context } from "@deepseek-ai/cordis";
import { describe, expect, it } from "vitest";

import { apply, inject, name } from "./index.js";

describe("dsh-auth plugin shape", () => {
  it("uses the stable plugin name", () => {
    expect(name).toBe("dsh-auth");
  });

  it("declares webServer as a hard dependency", () => {
    expect(inject).toContain("webServer");
  });

  it("exits cleanly when webServer is absent", () => {
    const ctx = { get: () => undefined } as unknown as Context;
    expect(() => apply(ctx, { mode: "token" })).not.toThrow();
  });

  it("reaches the guard seam when webServer is present", () => {
    const ctx = { get: () => ({}) } as unknown as Context;
    expect(() => apply(ctx, { mode: "password" })).not.toThrow();
  });
});
