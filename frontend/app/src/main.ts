// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

console.log("Perf: ", performance.getEntries());

performance.mark("bootstrapping_svelte");

import "svelte";
import App from "./components/App.svelte";

const app = new App({
    target: document.body,
});

export default app;
