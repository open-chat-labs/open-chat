// import "./styles/global.scss";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

import "svelte";
import { mount } from "svelte";
import App from "./components/App.svelte";

const app = mount(App, { target: document.body });

export default app;
