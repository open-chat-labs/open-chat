// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import "svelte";
import { mount } from "svelte";
import App from "./components/App.svelte";
import AppV2 from "./components_v2/App.svelte";
import { setNativeTheme, writeNativeCssVariables } from "./theme/themes";

const v2 = localStorage.getItem("openchat_v2_layout") === "true";

if (v2) {
    setNativeTheme();
} else {
    writeNativeCssVariables();
}

const app = v2 ? mount(AppV2, { target: document.body }) : mount(App, { target: document.body });

export default app;
