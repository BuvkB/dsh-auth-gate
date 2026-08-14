import type { Context } from "@deepseek-ai/cordis";
import { describe, expect, it } from "vitest";
import {
  isGuarded,
  type HttpHandler,
  type WrappableRoute,
  type WrappableServer,
  type WrappableUpgradeRoute,
} from "./guard.js";
import { apply, Config, inject, name, type AuthConfig, type AuthService } from "./index.js";
import { SessionStore, type Session } from "./session-store.js";

function cfg(): AuthConfig {
  return { mode: "token", sessionTtl: 604800, cookieName: "dsh_auth" };
}

function makeFakeServer(): WrappableServer {
  const exact = new Map<string, WrappableRoute>();
  const prefixes = new Map<string, WrappableRoute>();
  const upgrades = new Map<string, WrappableUpgradeRoute>();
  const server: WrappableServer = {
    exact,
    prefixes,
    upgrades,
    fallback: undefined,
    register(route) {
      exact.set(route.path, route);
      return () => exact.delete(route.path);
    },
    registerUpgrade(route) {
      upgrades.set(route.path, route);
      return () => upgrades.delete(route.path);
    },
    registerFallback(handler) {
      server.fallback = handler;
      return () => {
        server.fallback = undefined;
      };
    },
  };
  return server;
}

interface FakeLog {
  level: string;
  message: unknown;
}

function makeCtx(server: WrappableServer | undefined, storageDomain: unknown) {
  const effects: (() => unknown)[] = [];
  const logs: FakeLog[] = [];
  const provided: Record<string, unknown> = {};
  const ctx = {
    get(serviceName: string): unknown {
      if (serviceName === "webServer") return server;
      if (serviceName === "storageDomain") return storageDomain;
      return undefined;
    },
    provide(serviceName: string, value: unknown): void {
      provided[serviceName] = value;
    },
    logger(): { error(message: unknown): void; info(message: unknown): void } {
      return {
        error: (message) => logs.push({ level: "error", message }),
        info: (message) => logs.push({ level: "info", message }),
      };
    },
    effect(callback: () => unknown): void {
      // Real cordis runs the effect body immediately and keeps its disposer.
      const disposer = callback();
      if (typeof disposer === "function") effects.push(disposer as () => unknown);
    },
  } as unknown as Context;
  return { ctx, effects, logs, provided };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("dsh-auth plugin shape", () => {
  it("uses the stable plugin name", () => {
    expect(name).toBe("dsh-auth");
  });

  it("declares webServer as a hard dependency", () => {
    expect(inject).toContain("webServer");
  });
});

describe("Config", () => {
  it("fills defaults from an empty config", () => {
    // schemastery's callable types want the full shape; runtime validation
    // is what fills the defaults (cordis passes raw user config the same way).
    expect(Config({} as AuthConfig)).toEqual({
      mode: "token",
      sessionTtl: 604800,
      cookieName: "dsh_auth",
    });
  });
});

describe("apply: 守卫与自检", () => {
  it("returns silently when webServer is absent", () => {
    const { ctx, provided } = makeCtx(undefined, undefined);
    expect(() => apply(ctx, cfg())).not.toThrow();
    expect(provided["auth"]).toBeUndefined();
  });

  it("mounts the guard and logs when storageDomain is missing", () => {
    const server = makeFakeServer();
    const marker: HttpHandler = () => undefined;
    server.exact.set("/probe", { kind: "exact", path: "/probe", handler: marker });
    const { ctx, logs, provided } = makeCtx(server, undefined);
    expect(() => apply(ctx, cfg())).not.toThrow();
    expect(isGuarded(server.exact.get("/probe")!.handler)).toBe(true);
    const auth = provided["auth"] as AuthService;
    expect(typeof auth.gate.decide).toBe("function");
    expect(auth.sessions).toBeUndefined();
    expect(logs.filter((entry) => entry.level === "error")).toHaveLength(1);
  });

  it("fails loud when an entry is not guarded", () => {
    const server = makeFakeServer();
    server.exact.set("/probe", { kind: "exact", path: "/probe", handler: () => undefined });
    const { ctx, logs } = makeCtx(server, undefined);
    apply(ctx, cfg());
    // Break the register method after the first apply.
    const plainRegister = server.register.bind(server);
    server.register = (route) => plainRegister(route);
    expect(() => apply(ctx, cfg())).toThrow(/guard self-check failed/);
    expect(
      logs.some(
        (entry) => entry.level === "error" && String(entry.message).includes("method register"),
      ),
    ).toBe(true);
  });
});

describe("apply: 会话层接线", () => {
  it("wires the session store when storageDomain opens", async () => {
    const server = makeFakeServer();
    const table = new Map<string, Session>();
    const fakeDomain = {
      table: () => table,
      close: () => undefined,
    };
    const { ctx, provided } = makeCtx(server, { open: () => Promise.resolve(fakeDomain) });
    apply(ctx, cfg());
    const auth = provided["auth"] as AuthService;
    expect(auth.sessions).toBeUndefined();
    await flush();
    expect(auth.sessions).toBeInstanceOf(SessionStore);
  });

  it("logs and keeps guards mounted when the domain open fails", async () => {
    const server = makeFakeServer();
    server.exact.set("/probe", { kind: "exact", path: "/probe", handler: () => undefined });
    const { ctx, logs, provided } = makeCtx(server, {
      open: () => Promise.reject(new Error("boom")),
    });
    expect(() => apply(ctx, cfg())).not.toThrow();
    await flush();
    const auth = provided["auth"] as AuthService;
    expect(auth.sessions).toBeUndefined();
    expect(isGuarded(server.exact.get("/probe")!.handler)).toBe(true);
    expect(
      logs.some((entry) => entry.level === "error" && String(entry.message).includes("boom")),
    ).toBe(true);
  });

  it("restores the guard and closes the domain on dispose", async () => {
    const server = makeFakeServer();
    const originalRoute: WrappableRoute = {
      kind: "exact",
      path: "/probe",
      handler: () => undefined,
    };
    server.exact.set("/probe", originalRoute);
    const closed: string[] = [];
    const fakeDomain = {
      table: () => new Map<string, Session>(),
      close: () => {
        closed.push("close");
      },
    };
    const { ctx, effects } = makeCtx(server, { open: () => Promise.resolve(fakeDomain) });
    apply(ctx, cfg());
    await flush();
    for (const disposer of [...effects].reverse()) {
      await disposer();
    }
    expect(server.exact.get("/probe")).toBe(originalRoute);
    expect(closed).toContain("close");
  });

  it("closes a domain that resolves after disposal", async () => {
    const server = makeFakeServer();
    let resolveOpen: (domain: unknown) => void = () => undefined;
    const closed: string[] = [];
    const { ctx, effects } = makeCtx(server, {
      open: () =>
        new Promise((resolve) => {
          resolveOpen = resolve;
        }),
    });
    apply(ctx, cfg());
    // Run disposers without awaiting: the domain disposer blocks on the
    // still-pending open promise, exactly like a real teardown would.
    const disposerResults = [...effects].reverse().map((disposer) => disposer());
    resolveOpen({
      table: () => new Map<string, Session>(),
      close: () => {
        closed.push("close");
      },
    });
    await Promise.all(disposerResults);
    await flush();
    expect(closed).toContain("close");
  });
});
