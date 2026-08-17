window.__ModuleLoader__.load({
	id: "dsh-auth-gate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/logout-action.tsx
		/** 登出按钮的可访问名（rail 模式文字视觉隐藏，按钮仍以 aria-label 命名）。 */
		const SIGN_OUT_LABEL = "Sign out";
		/** 登出目标：POST-only（M22：next 仅从 query 取，校验回落 /）。 */
		const LOGOUT_TARGET = "/auth/logout?next=/";
		const LOGOUT_ICON = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
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
		const formStyle = { display: "contents" };
		const buttonStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			height: 32,
			padding: "0 10px",
			border: 0,
			borderRadius: 6,
			background: "transparent",
			color: "inherit",
			cursor: "pointer",
			font: "inherit",
			fontSize: 13
		};
		const visuallyHiddenStyle = {
			position: "absolute",
			width: 1,
			height: 1,
			padding: 0,
			margin: -1,
			overflow: "hidden",
			clip: "rect(0 0 0 0)",
			whiteSpace: "nowrap",
			border: 0
		};
		/**
		* 侧边栏底部登出入口。挂载时 fetch /auth/status 一次（只认 cookie），仅
		* authenticated:true 时渲染；登出走原生 form POST（零 JS 依赖，302 回落
		* / → 门禁 → 登录页）。
		*/
		function LogoutAction({ wide }) {
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
			if (authenticated !== true) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("form", {
				method: "post",
				action: LOGOUT_TARGET,
				style: formStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "submit",
					"aria-label": SIGN_OUT_LABEL,
					title: SIGN_OUT_LABEL,
					style: buttonStyle,
					children: [LOGOUT_ICON, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: wide ? void 0 : visuallyHiddenStyle,
						children: SIGN_OUT_LABEL
					})]
				})
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* dsh-auth-gate client 半边：认证后在 GUI 侧边栏底部（sidebar.footer.action，
		* root 级恒显示、可追加）挂一个登出入口。登出语义全部复用服务端冻结端点
		* （POST /auth/logout、GET /auth/status），本半边只负责渲染与门控。
		*/
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-auth-gate-logout",
				order: 0,
				label: "Sign out"
			}, LogoutAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map