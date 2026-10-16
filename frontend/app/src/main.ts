// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import "./web-components/customEmoji";
import "./web-components/profileLink";
import "./web-components/spoiler";

import { isTauriApp, mobileWidth } from "@client";
import "svelte";
import { mount } from "svelte";
import {
    clearStartupBackground,
    setNativeTheme,
    writeLayoutCssVariables,
    writeNativeCssVariables,
} from "./theme/themes";
import { selectLayout } from "./utils/layout";

// Picks the app variant once at startup. The native Android build ships
// OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always mount the mobile
// App (components_mobile). That is where the native cold-start machinery lives —
// reliable notification-tap routing, pending deep-link/tap consumption in
// Router.svelte, and the listeners-before-svelteReady sequencing. The v1 App
// (components) only renders on >=768px viewports (desktop web, large tablets)
// and intentionally does not implement that native cold-start routing.
//
// A build with OC_WEB_LAYOUT=v3 mounts the new web UI (src/web) instead of the
// v1 App on >=768px viewports, outside the native apps. It is opt-in per build while it is being built:
// the flag is a build-time constant, so without it the condition below is
// constant-false and the bundler leaves the web tree out of the build.
//
// The two trees are loaded with dynamic import() so that only the selected one
// is downloaded and parsed. The decision is made synchronously before either
// import starts, and the native side queues cold-start events until the mobile
// App signals svelteReady, so deferring the mount by one chunk load is safe.
const layout = selectLayout(
    import.meta.env.OC_MOBILE_LAYOUT,
    import.meta.env.OC_WEB_LAYOUT,
    mobileWidth.value,
    isTauriApp(),
);

if (layout === "v2") {
    setNativeTheme();
} else if (layout === "v3") {
    writeLayoutCssVariables();
} else {
    writeNativeCssVariables();
}

const app = (
    layout === "v2"
        ? import("./components_mobile/App.svelte")
        : import.meta.env.OC_WEB_LAYOUT === "v3" && layout === "v3"
          ? import("./web/App.svelte")
          : import("./components/App.svelte")
).then(({ default: App }) => {
    const mounted = mount(App, { target: document.body });
    clearStartupBackground();
    return mounted;
});

export default app;
