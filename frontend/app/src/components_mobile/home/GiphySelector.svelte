<script lang="ts">
    import { ColourVars, Column, Container, Row, Search } from "component-lib";
    import { type GiphyContent, type TenorObject, type TenorSearchResponse } from "openchat-client";
    import { onMount } from "svelte";

    type KeyedTenorObject = TenorObject & { key: string };

    interface Props {
        onSend: (content: GiphyContent) => void;
    }

    let { onSend }: Props = $props();

    onMount(reset);

    let refreshing = $state(false);
    let searchTerm = $state<string>();
    let gifs: KeyedTenorObject[] = $state([]);
    let gifCache: Record<
        string,
        KeyedTenorObject & { top: number; left: number; calculatedHeight: number }
    > = $state({});
    let pageSize = 25;
    let containerElement: HTMLDivElement;
    const gutter = 5;
    let imgWidth = $state(0);
    let pos = "";

    const TRENDING_API_URL = `https://tenor.googleapis.com/v2/featured?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=${
        import.meta.env.OC_TENOR_APIKEY
    }&limit=${pageSize}`;
    const SEARCH_API_URL = `https://tenor.googleapis.com/v2/search?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=${
        import.meta.env.OC_TENOR_APIKEY
    }&limit=${pageSize}&q=`;

    function sumOfHeightsForColumn(
        cache: Record<
            string,
            KeyedTenorObject & { top: number; left: number; calculatedHeight: number }
        >,
        row: number,
        col: number,
    ): number {
        let height = 0;
        for (let i = 0; i < row; i++) {
            const gif = cache[`${i}_${col}`];
            if (gif !== undefined) {
                height += gif.calculatedHeight;
            }
        }
        return height;
    }

    function reduceGifs(
        numCols: number,
        cache: Record<
            string,
            KeyedTenorObject & { top: number; left: number; calculatedHeight: number }
        >,
        gif: KeyedTenorObject,
        i: number,
    ): Record<string, KeyedTenorObject & { top: number; left: number; calculatedHeight: number }> {
        const col = i % numCols;
        const row = Math.floor(i / numCols);
        const scale = gif.media_formats.tinygif.dims[0] / imgWidth;
        const calcHeight = gif.media_formats.tinygif.dims[1] / scale;
        const key = `${row}_${col}`;

        cache[key] = {
            ...gif,
            top: sumOfHeightsForColumn(cache, row, col) + row * gutter,
            left: col * imgWidth + col * gutter,
            calculatedHeight: calcHeight,
        };
        return cache;
    }

    function addKey(index: number, pos: string, gif: TenorObject): KeyedTenorObject {
        return {
            key: `${index}_${pos}`,
            ...gif,
        };
    }

    function getMoreGifs() {
        refreshing = true;
        const url =
            searchTerm === ""
                ? `${TRENDING_API_URL}&pos=${pos}`
                : `${SEARCH_API_URL}${searchTerm}&pos=${pos}`;
        return fetch(url)
            .then((res) => res.json())
            .then((res: TenorSearchResponse) => {
                pos = `${res.next}`;
                return res.results;
            })
            .then((res) => res.map((result, i) => addKey(i, pos, result)))
            .finally(() => (refreshing = false));
    }

    export function reset(search?: string) {
        searchTerm = search;
        gifs = [];
        pos = "";
        nextPage();
    }

    function send(gif: KeyedTenorObject) {
        if (gif !== undefined) {
            const content: GiphyContent = {
                kind: "giphy_content",
                title: gif.title,
                desktop: {
                    height: Number(gif.media_formats.mp4.dims[1]),
                    width: Number(gif.media_formats.mp4.dims[0]),
                    url: gif.media_formats.mp4.url,
                    mimeType: "video/mp4",
                },
                mobile: {
                    height: Number(gif.media_formats.tinygif.dims[1]),
                    width: Number(gif.media_formats.tinygif.dims[0]),
                    url: gif.media_formats.tinygif.url,
                    mimeType: "image/gif",
                },
            };
            onSend(content);
        }
    }

    async function nextPage() {
        if (refreshing) return;
        const nextPage = await getMoreGifs();
        gifs = [...gifs, ...nextPage];
    }

    function onScroll() {
        if (containerElement) {
            if (
                Math.abs(
                    containerElement.scrollHeight -
                        containerElement.clientHeight -
                        containerElement.scrollTop,
                ) < 200
            ) {
                nextPage();
            }
        }
    }
    $effect(() => {
        let containerWidth = containerElement?.clientWidth ?? 0;
        let numCols = 3;
        let availWidth = containerWidth - (numCols - 1) * gutter;
        imgWidth = availWidth / numCols;
        gifCache = gifs.reduce((cache, gif, i) => reduceGifs(numCols, cache, gif, i), {});
    });
</script>

<Column padding={["sm", "md", "lg", "md"]}>
    <Row>
        <Search
            padding={["sm", "lg"]}
            background={ColourVars.background1}
            borderColour={ColourVars.textTertiary}
            borderWidth={"thin"}
            bind:value={searchTerm}
            onSearch={reset}
            onClear={() => reset()}
            placeholder={"Search Tenor..."} />
    </Row>
</Column>

<Container padding={["zero", "md"]}>
    <div class="giphy-container" onscroll={onScroll} bind:this={containerElement}>
        {#each Object.values(gifCache) as item (item.key)}
            <img
                class="thumb"
                onclick={() => send(item)}
                src={item.media_formats.tinygif.url}
                style={`width: ${imgWidth}px; top: ${item.top}px; left: ${item.left}px`}
                alt={item.title} />
        {/each}
    </div>
</Container>

<style lang="scss">
    .giphy-container {
        overflow: auto;
        position: relative;
        height: calc(var(--vh, 1vh) * 50);
        width: 100%;
    }

    .thumb {
        position: absolute;
        cursor: pointer;
        display: block;
    }
</style>
