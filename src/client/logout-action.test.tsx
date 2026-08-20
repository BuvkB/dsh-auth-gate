// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "./context.ts";
import { apply } from "./index.tsx";
import { SidebarLogoutAction } from "./logout-action.tsx";

// React 18 的 act() 需要显式声明测试环境（否则只警告不生效）。
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 让 fetch mock 的整条微任务链（json → setAuthenticated）在 act 内跑完。 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** 渲染组件到独立容器（jsdom），返回 root 供卸载。 */
async function renderElement(
  element: ReturnType<typeof createElement>,
): Promise<{ root: Root; container: HTMLDivElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
    await flushMicrotasks();
  });
  return { root, container };
}

/** 构造带 mock 的 AuthContext（slots + locale + effect）。 */
function makeApplyHarness() {
  const zh: [string, string, Record<string, string>][] = [];
  const en: [string, string, Record<string, string>][] = [];
  const localeRegisters: [string, string, Record<string, string>][] = [];
  const locale = {
    register: vi.fn((ns: string, loc: string, dict: Record<string, string>): (() => void) => {
      localeRegisters.push([ns, loc, dict]);
      if (loc === "zh") zh.push([ns, loc, dict]);
      if (loc === "en") en.push([ns, loc, dict]);
      return () => undefined;
    }),
    bind: vi.fn(() => (key: string) => (key === "logout" ? "Sign out" : key)),
  };
  const injectCalls: [string, () => () => void][] = [];
  const slots = {
    inject: vi.fn((key: string, callback: () => () => void) => {
      injectCalls.push([key, callback]);
      return () => undefined;
    }),
    register: vi.fn(() => () => undefined),
  };
  const effect = vi.fn((setup: () => () => void | Iterable<() => void>): void => {
    setup();
  });
  const ctx = { slots, locale, effect } as unknown as AuthContext;
  return { ctx, localeRegisters, slots, injectCalls };
}

describe("apply", () => {
  it("registers zh/en logout dicts and adds the row to the sidebar footer slot", () => {
    const h = makeApplyHarness();
    apply(h.ctx);
    expect(h.localeRegisters).toEqual([
      ["auth", "zh", { logout: "登出" }],
      ["auth", "en", { logout: "Sign out" }],
    ]);
    expect(h.injectCalls.map(([key]) => key).sort((a, b) => a.localeCompare(b))).toEqual([
      "sidebar.footer.action",
    ]);
    const register = h.slots.register as ReturnType<typeof vi.fn>;
    for (const [, callback] of h.injectCalls) callback();
    const call = register.mock.calls[0] as unknown as [
      { name: string; id: string; locale: string; order: number; label: unknown },
      unknown,
    ];
    const [opts, component] = call;
    expect(opts.name).toBe("sidebar.footer.action");
    expect(opts.id).toBe("dsh-auth-gate-logout");
    expect(opts.locale).toBe("auth");
    expect(opts.order).toBe(1);
    expect(typeof opts.label).toBe("function");
    expect((opts.label as () => string)()).toBe("Sign out");
    expect(component).toBe(SidebarLogoutAction);
  });
});

describe("SidebarLogoutAction (sidebar footer row)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  /** /auth/status 返回给定 authenticated 值。 */
  function statusResponse(authenticated: boolean): unknown {
    return { json: () => Promise.resolve({ authenticated }) };
  }

  function enT(): (key: string) => string {
    return () => "Sign out";
  }

  it("renders a labeled logout row (post form + 16px icon + en text) when authenticated", async () => {
    fetchMock.mockResolvedValue(statusResponse(true));
    const { root, container } = await renderElement(
      createElement(SidebarLogoutAction, { t: enT() }),
    );
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form?.getAttribute("action")).toBe("/auth/logout?next=/");
    expect(form?.getAttribute("method")).toBe("post");
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Sign out");
    expect(button?.querySelector("svg")).not.toBeNull();
    expect(button?.textContent).toContain("Sign out");
    root.unmount();
    container.remove();
  });

  it("shows the zh label when the injected t translates logout to 登出", async () => {
    fetchMock.mockResolvedValue(statusResponse(true));
    const zh = () => "登出";
    const { root, container } = await renderElement(createElement(SidebarLogoutAction, { t: zh }));
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("登出");
    expect(button?.textContent).toContain("登出");
    root.unmount();
    container.remove();
  });

  it("renders nothing when unauthenticated", async () => {
    fetchMock.mockResolvedValue(statusResponse(false));
    const { root, container } = await renderElement(
      createElement(SidebarLogoutAction, { t: enT() }),
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toBe("");
    root.unmount();
    container.remove();
  });

  it("renders nothing when the status fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const { root, container } = await renderElement(
      createElement(SidebarLogoutAction, { t: enT() }),
    );
    expect(container.querySelector("form")).toBeNull();
    root.unmount();
    container.remove();
  });

  it("shows the theme hover background token on hover and clears it on leave", async () => {
    fetchMock.mockResolvedValue(statusResponse(true));
    const { root, container } = await renderElement(
      createElement(SidebarLogoutAction, { t: enT() }),
    );
    const button = container.querySelector("button")!;
    expect(button.style.background).toBe("transparent");
    act(() => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(button.style.background).toBe("var(--dsw-alias-interactive-bg-hover)");
    act(() => {
      button.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(button.style.background).toBe("transparent");
    root.unmount();
    container.remove();
  });
});
