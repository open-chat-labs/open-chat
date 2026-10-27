<script lang="ts">
    // Throwaway harness for checking the price chart message views by eye. Not for committing.
    import { applyTheme } from "component-lib";
    import { currentTheme, themeOverride } from "@theme/themes";
    import type { PriceChartContent } from "@client";
    import DesktopContent from "./components/home/PriceChartContent.svelte";
    import MobileContent from "./components_mobile/home/PriceChartContent.svelte";
    import { onMount } from "svelte";

    let { tree, mode }: { tree: "desktop" | "mobile"; mode: "light" | "dark" } = $props();

    const BASE = "https://d2r0806cxz8193.cloudfront.net";
    const CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";
    const ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
    const DAY = 24 * 60 * 60 * 1000;
    const SOURCES = [
        { name: "ICPSwap", url: "https://www.icpswap.com" },
        { name: "CoinGecko", url: "https://www.coingecko.com" },
    ];

    let contents: PriceChartContent[] = $state([]);
    let clicked = $state("");

    async function points(path: string) {
        const r = await fetch(`${BASE}${path}`);
        const body = (await r.json()) as { points: [number, number][] };
        return body.points.map(([timestamp, usd]) => ({ timestamp, usd }));
    }

    onMount(async () => {
        document.body.addEventListener("cashtag-clicked", (e) => {
            clicked = JSON.stringify((e as CustomEvent).detail);
        });
        if (tree === "desktop") {
            themeOverride.set(mode === "dark" ? "dark" : "white");
            currentTheme.subscribe(() => {});
            const cs = getComputedStyle(document.documentElement);
            document.body.style.background = cs.getPropertyValue("--currentChat-msg-bg");
            document.body.style.color = cs.getPropertyValue("--currentChat-msg-txt");
        } else {
            applyTheme("neon");
        }
        const end = Date.now();
        const start = end - 7 * DAY;
        const chat = await points(`/v1/prices/${CHAT}/history?range=7d`);
        const icp = await points(`/v1/prices/${ICP}/history?range=7d`);
        const ada = await points(`/v1/coins/cardano/history?range=7d`);
        const series = (symbol: string, name: string, token: PriceChartContent["series"][0]["token"], p: { timestamp: number; usd: number }[]) => ({
            token, symbol, name, points: p.filter((x) => x.timestamp >= start),
        });
        contents = [
            {
                kind: "price_chart_content",
                title: "CHAT over the past 7 days",
                start,
                end,
                series: [series("CHAT", "OpenChat", { kind: "token", ledger: CHAT }, chat)],
                sources: [SOURCES[0]],
            },
            {
                kind: "price_chart_content",
                title: "CHAT, ICP and ADA over the past 7 days",
                start,
                end,
                series: [
                    series("CHAT", "OpenChat", { kind: "token", ledger: CHAT }, chat),
                    series("ICP", "Internet Computer", { kind: "token", ledger: ICP }, icp),
                    series("ADA", "Cardano", { kind: "coin", id: "cardano" }, ada),
                ],
                sources: SOURCES,
            },
        ];
    });
</script>

<div class="harness">
    <p data-clicked>{clicked}</p>
    {#each contents as content}
        <div class="bubble">
            {#if tree === "desktop"}
                <DesktopContent {content} />
            {:else}
                <MobileContent {content} />
            {/if}
        </div>
        <div class="bubble">
            {#if tree === "desktop"}
                <DesktopContent {content} reply />
            {:else}
                <MobileContent {content} reply />
            {/if}
        </div>
    {/each}
</div>

<style>
    .harness {
        padding: 16px 32px;
        font-family: sans-serif;
    }
    .bubble {
        display: inline-block;
        margin-bottom: 24px;
        padding: 8px 12px;
        border-radius: 12px;
        outline: 1px dashed rgba(128, 128, 128, 0.4);
    }
</style>
