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
import App from "@src/desktop/shell/App.svelte";
import AppV2 from "@src/mobile/shell/App.svelte";
import { setNativeTheme, writeNativeCssVariables } from "./theme/themes";

// Picks the app variant once at startup. The native Android build ships
// OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always mount AppV2
// (src/mobile). AppV2 is where the native cold-start machinery lives —
// reliable notification-tap routing, pending deep-link/tap consumption in
// Router.svelte, and the listeners-before-svelteReady sequencing. The v1 App
// (src/desktop) only renders on >=768px viewports (desktop web, large tablets)
// and intentionally does not implement that native cold-start routing.
const v2 = import.meta.env.OC_MOBILE_LAYOUT === "v2" && mobileWidth.value;

if (v2) {
    setNativeTheme();
} else {
    writeNativeCssVariables();
}

const app = v2 ? mount(AppV2, { target: document.body }) : mount(App, { target: document.body });

export default app;
