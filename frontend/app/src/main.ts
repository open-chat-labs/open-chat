// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import "./web-components/customEmoji";
import "./web-components/profileLink";
import "./web-components/spoiler";

import { mobileWidth } from "@client";
import { prepareServiceWorkerBeforeApplicationStart } from "@client/utils/updateSw";
import "svelte";
import { mount } from "svelte";
import StartupFailure from "./components_shared/StartupFailure.svelte";
import { setNativeTheme, writeNativeCssVariables } from "./theme/themes";
import { selectLayout } from "./utils/layout";
import { isNativeClient, usesWebInferenceRuntime } from "./utils/onDeviceInference";
import { ensureWebModelRestored } from "./utils/webInference";

async function startApplication() {
    const nativeClient = isNativeClient();
    // A production worker left on this development origin can serve a stale /worker.js and strand
    // authentication before the old post-login cleanup is reachable. Browser storage APIs can
    // themselves stall, so this preparation has a short fail-open deadline.
    if (!nativeClient) {
        try {
            if (!(await prepareServiceWorkerBeforeApplicationStart())) return undefined;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "A stale background worker still controls this page. Open OpenChat in a fresh tab, then close this tab.";
            // Recovery must already be in the bootstrap graph: a stale controller may also
            // prevent an additional component chunk from loading at exactly this point.
            return mount(StartupFailure, {
                target: document.body,
                props: { message, recovery: "new-tab" },
            });
        }
    }

    // Browser and feature-flagged Android WebGPU builds re-attach the persisted model at boot, so
    // propose works after an APK restart without first opening Model Manager. Service-worker
    // maintenance above remains browser-only.
    if (usesWebInferenceRuntime()) void ensureWebModelRestored();

    // Picks the app variant once at startup. The native Android build ships
    // OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always mount AppV2
    // (components_mobile). AppV2 is where the native cold-start machinery lives —
    // reliable notification-tap routing, pending deep-link/tap consumption in
    // Router.svelte, and the listeners-before-svelteReady sequencing. The v1 App
    // (components) only renders on >=768px viewports (desktop web, large tablets)
    // and intentionally does not implement that native cold-start routing.
    const layout = selectLayout(import.meta.env.OC_MOBILE_LAYOUT, mobileWidth.value);

    if (layout === "v2") {
        setNativeTheme();
    } else {
        writeNativeCssVariables();
    }

    // Load only the selected tree after browser worker preparation. Native cold-start events
    // remain queued until the mounted mobile app signals svelteReady.
    const { default: App } = await (layout === "v2"
        ? import("./components_mobile/App.svelte")
        : import("./components/App.svelte"));
    return mount(App, { target: document.body });
}

const app = startApplication();

export default app;
