// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import "./web-components/cashTag";
import "./web-components/customEmoji";
import "./web-components/profileLink";
import "./web-components/spoiler";

import { configKeys, dimensionsWidth, isTauriApp } from "@client";
import "svelte";
import { mount } from "svelte";
import {
    clearStartupBackground,
    setNativeTheme,
    writeLayoutCssVariables,
    writeNativeCssVariables,
} from "./theme/themes";
import { linkFonts } from "./utils/fonts";
import { layoutOverrideOf, selectLayout, type LayoutOverride } from "./utils/layout";

// Picks the app variant once at startup (`selectLayout`, utils/layout.ts). The native Android build
// ships OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always mount the mobile App
// (components_mobile). That is where the native cold-start machinery lives — reliable
// notification-tap routing, pending deep-link/tap consumption in Router.svelte, and the
// listeners-before-svelteReady sequencing (utils/native/nativeApp.ts). The v1 App (components)
// only renders on >=768px viewports (desktop web, large tablets) and intentionally does not
// implement that native cold-start routing.
//
// A build with OC_WEB_LAYOUT=v3 mounts the new web UI (src/web) instead of the v1 App on >=768px
// viewports, outside the native apps. A build with OC_NATIVE_LAYOUT=v4 mounts the native tree
// (src/native) in the native apps and on phones instead of the mobile App; it takes over the native
// cold-start machinery. Both are opt-in per build while they are being built: the flags are
// build-time constants, so without one the conditions below are constant-false and the bundler
// leaves that tree out of the build.
//
// The trees are loaded with dynamic import() so that only the selected one is downloaded and parsed.
// The decision is made synchronously before any import starts, and the native side queues
// cold-start events until the App signals svelteReady, so deferring the mount by one chunk load is
// safe.
const layout = selectLayout({
    mobileLayoutFlag: import.meta.env.OC_MOBILE_LAYOUT,
    webLayoutFlag: import.meta.env.OC_WEB_LAYOUT,
    nativeLayoutFlag: import.meta.env.OC_NATIVE_LAYOUT,
    width: dimensionsWidth.value,
    coarsePointer: matchesMedia("(pointer: coarse)"),
    canHover: matchesMedia("(hover: hover)"),
    nativeApp: isTauriApp(),
    override: storedLayoutOverride(),
});

function matchesMedia(query: string): boolean {
    return window.matchMedia?.(query).matches ?? false;
}

function storedLayoutOverride(): LayoutOverride | undefined {
    try {
        return layoutOverrideOf(localStorage.getItem(configKeys.layoutOverride));
    } catch {
        // without storage there's no override
        return undefined;
    }
}

const newTree = layout === "v3" || layout === "v4";
linkFonts(newTree ? import.meta.env.OC_WEB_FONTS_URL : import.meta.env.OC_APP_FONTS_URL);

if (layout === "v2") {
    setNativeTheme();
} else if (newTree) {
    writeLayoutCssVariables();
} else {
    writeNativeCssVariables();
}

if (layout === "v4") {
    // the native tree draws under the system bars and pads by the safe areas (--safe-*), which
    // env(safe-area-inset-*) only reports with viewport-fit=cover
    coverViewport();
}

function coverViewport(): void {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (meta !== null && !meta.content.includes("viewport-fit")) {
        meta.content = `${meta.content}, viewport-fit=cover`;
    }
}

const app = (
    import.meta.env.OC_NATIVE_LAYOUT === "v4" && layout === "v4"
        ? import("./native/App.svelte")
        : layout === "v2"
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
