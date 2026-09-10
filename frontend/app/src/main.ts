// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import "./web-components/customEmoji";
import "./web-components/profileLink";
import "./web-components/spoiler";

import { mobileWidth } from "@client";
import "svelte";
import { mount } from "svelte";
import { setNativeTheme, writeNativeCssVariables } from "./theme/themes";
import { selectLayout } from "./utils/layout";

// Picks the app variant once at startup. The native Android build ships
// OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always mount the mobile
// App (components_mobile). That is where the native cold-start machinery lives —
// reliable notification-tap routing, pending deep-link/tap consumption in
// Router.svelte, and the listeners-before-svelteReady sequencing. The v1 App
// (components) only renders on >=768px viewports (desktop web, large tablets)
// and intentionally does not implement that native cold-start routing.
//
// The two trees are loaded with dynamic import() so that only the selected one
// is downloaded and parsed. The decision is made synchronously before either
// import starts, and the native side queues cold-start events until the mobile
// App signals svelteReady, so deferring the mount by one chunk load is safe.
// A dynamic import fails when the deploy that just went out replaced the hashed chunks this
// page's index.html still points at (or the network dropped mid-load). Vite raises
// vite:preloadError for it; a reload fetches the new index.html and the chunks it names.
// Once per version, so a chunk that is genuinely missing surfaces as the error it is rather
// than a reload loop.
window.addEventListener("vite:preloadError", (event) => {
    const key = "oc_chunk_reload_version";
    const version = import.meta.env.OC_WEBSITE_VERSION;
    try {
        if (sessionStorage.getItem(key) === version) return;
        sessionStorage.setItem(key, version);
    } catch {
        return;
    }
    event.preventDefault();
    window.location.reload();
});

const layout = selectLayout(import.meta.env.OC_MOBILE_LAYOUT, mobileWidth.value);

if (layout === "v2") {
    setNativeTheme();
} else {
    writeNativeCssVariables();
}

const app = (
    layout === "v2"
        ? import("./components_mobile/App.svelte")
        : import("./components/App.svelte")
).then(({ default: App }) => mount(App, { target: document.body }));

export default app;
