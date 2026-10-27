// Throwaway harness for checking the price chart message views by eye. Not for committing.
import { mount } from "svelte";
import PriceChartHarness from "./PriceChartHarness.svelte";

const params = new URLSearchParams(location.search);
mount(PriceChartHarness, {
    target: document.getElementById("harness")!,
    props: {
        tree: (params.get("tree") ?? "desktop") as "desktop" | "mobile",
        mode: (params.get("mode") ?? "light") as "light" | "dark",
    },
});
