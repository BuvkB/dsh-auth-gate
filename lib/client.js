window.__ModuleLoader__.load({
	id: "dsh-auth-gate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/logout-action.tsx
		/** 登出目标：POST-only（M22：next 仅从 query 取，校验回落 /）。 */
		const LOGOUT_TARGET = "/auth/logout?next=/";
		/**
		* 登出图标：16px 列表行图标（viewBox 24 不变，只设 width/height 16）。
		* 沿用原 32px 圆形按钮的同一个 SVG（方框 + 箭头）。
		*/
		function renderLogoutIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 24 24",
				width: 16,
				height: 16,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "16 17 21 12 16 7" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: "21",
						y1: "12",
						x2: "9",
						y2: "12"
					})
				]
			});
		}
		/**
		* hover 态背景色：与侧边栏其他交互行同主题 token
		* `var(--dsw-alias-interactive-bg-hover)`（浅主题 rgba(38,49,72,.06)，
		* 深主题 rgba(255,255,255,.08)）。
		*/
		const HOVER_BACKGROUND = "var(--dsw-alias-interactive-bg-hover)";
		/**
		* 侧边栏 footer 登出行的基础样式：普通列表行（与「设置」同一行语言）——
		* 16px 图标 + 文字标签，display:flex；align-items:center；gap:9px；
		* padding:9px 8px；border-radius:8px。
		*/
		const ROW_STYLE = {
			display: "flex",
			alignItems: "center",
			gap: 9,
			padding: "9px 8px",
			borderRadius: 8,
			width: "100%",
			boxSizing: "border-box",
			color: "var(--dsw-alias-label-primary)",
			background: "transparent",
			border: "none",
			cursor: "pointer",
			fontFamily: "inherit",
			fontSize: 14,
			lineHeight: 20,
			textAlign: "left"
		};
		const labelWrapStyle = {
			display: "block",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const formStyle = { display: "contents" };
		/**
		* 会话状态门控：挂载时 fetch /auth/status 一次（只认 cookie）。
		* @returns authenticated：null = 未知（第一次请求前），true/false。
		*/
		function useAuthenticated() {
			const [authenticated, setAuthenticated] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				fetch("/auth/status").then((res) => res.json()).then((body) => {
					if (!cancelled) setAuthenticated(body.authenticated === true);
				}).catch(() => {
					if (!cancelled) setAuthenticated(false);
				});
				return () => {
					cancelled = true;
				};
			}, []);
			return authenticated;
		}
		/**
		* 可复用的登出提交行：原生 form POST（零 JS 依赖）+ 16px 方块图标 + 本地化文字 + 主题 hover。
		* 渲染进 `sidebar.footer.action`（侧边栏 footer 的可追加列表槽）——「设置」同一脚组。
		*/
		function SidebarLogoutAction({ t }) {
			const authenticated = useAuthenticated();
			const [hovered, setHovered] = (0, react.useState)(false);
			if (authenticated !== true) return null;
			const label = typeof t === "function" ? t("logout") : "Sign out";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("form", {
				method: "post",
				action: LOGOUT_TARGET,
				style: formStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "submit",
					"aria-label": label,
					title: label,
					style: {
						...ROW_STYLE,
						background: hovered ? HOVER_BACKGROUND : "transparent"
					},
					onMouseEnter: () => setHovered(true),
					onMouseLeave: () => setHovered(false),
					children: [renderLogoutIcon(), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelWrapStyle,
						children: label
					})]
				})
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/** 本插件文案的词典命名域（locale 服务按 (ns, locale) 分开注册）。 */
		const AUTH_NS = "auth";
		/** 命名词典里登出键。 */
		const LOGOUT_KEY = "logout";
		/**
		* dsh-auth-gate client 半边：认证后在**侧边栏 footer**（「设置」同一脚组）挂一
		* 行「登出 / Sign out」入口——`sidebar.footer.action`（root 作用域、可追加列表槽，
		* 由 ui-sidebar 在侧边栏脚区渲染，与 `sidebar.settings` 的触发行同一分组、不加分隔线）。
		*
		* 换槽对比：不再往会话页 `conversation.session.header.utilities` 和新会话页
		* `shell.overlay` 注册（右上角两处纯图标入口已移除）。文案挂进 dsh 现有的 locale
		* 机制（与「设置」里的语言切换同一套）：注册 `auth` 词典（zh/en），再以
		* `locale: "auth"` 给注册条目注入 `t` seat，行文字随界面语言在「登出」/ "Sign out"
		* 间实时切换。不改任何服务端端点/会话语义。
		*/
		const inject = ["slots", "locale"];
		function apply(ctx) {
			ctx.effect(() => [ctx.locale.register(AUTH_NS, "zh", { [LOGOUT_KEY]: "登出" }), ctx.locale.register(AUTH_NS, "en", { [LOGOUT_KEY]: "Sign out" })], "auth: logout dictionary");
			const t = ctx.locale.bind(AUTH_NS);
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-auth-gate-logout",
				locale: AUTH_NS,
				order: 1,
				label: () => t(LOGOUT_KEY)
			}, SidebarLogoutAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map