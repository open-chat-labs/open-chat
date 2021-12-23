// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import "svelte";
import { rollbar } from "utils/logging";
import App from "./App.svelte";

const app = new App({
    target: document.body,
});

export default app;

rollbar.error("yo yo yo this is a test");
