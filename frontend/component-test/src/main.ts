import { mount } from "svelte";
import App from "./App.svelte";
import "./styles.scss";

const app = mount(App, { target: document.body! });

export default app;
