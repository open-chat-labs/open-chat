<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Input from "../Input.svelte";
    import Link from "../Link.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import type { GiphyContent, TenorSearchResponse, TenorObject } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    type KeyedTenorObject = TenorObject & { key: string };

    const dispatch = createEventDispatcher();

    export let open: boolean;

    let refreshing = false;
    let message = "";
    let searchTerm = "";
    let gifs: KeyedTenorObject[] = [];
    let gifCache: Record<
        string,
        KeyedTenorObject & { top: number; left: number; calculatedHeight: number }
    > = {};
    let timer: number | undefined;
    let modalWidth = 0;
    let pageSize = 25;
    let selectedGif: KeyedTenorObject | undefined;
    let containerElement: HTMLDivElement;
    const gutter = 5;
    let imgWidth = 0;
    let pos = "";

    $: selectedImage =
        selectedGif === undefined
            ? undefined
            : $mobileWidth
              ? { ...selectedGif.media_formats.tinygif }
              : { ...selectedGif.media_formats.mediumgif };

    const TRENDING_API_URL = `https://tenor.googleapis.com/v2/featured?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=${
        import.meta.env.OC_TENOR_APIKEY
    }&limit=${pageSize}`;
    const SEARCH_API_URL = `https://tenor.googleapis.com/v2/search?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=${
        import.meta.env.OC_TENOR_APIKEY
    }&limit=${pageSize}&q=`;

    $: {
        let containerWidth = containerElement?.clientWidth ?? 0;
        let numCols = $mobileWidth ? 2 : 4;
        let availWidth = containerWidth - (numCols - 1) * gutter;
        imgWidth = availWidth / numCols;
        gifCache = gifs.reduce((cache, gif, i) => reduceGifs(numCols, cache, gif, i), {});
    }

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

    function onChange(ev: CustomEvent<string>) {
        if (ev.detail === searchTerm) {
            return;
        }

        searchTerm = ev.detail;
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            if (searchTerm.length > 2) {
                reset(searchTerm);
            }
        }, 500);
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

    export function reset(search: string) {
        message = "";
        searchTerm = search;
        selectedGif = undefined;
        gifs = [];
        pos = "";
        nextPage();
    }

    function send() {
        if (selectedGif !== undefined) {
            const content: GiphyContent = {
                kind: "giphy_content",
                title: selectedGif.title,
                desktop: {
                    height: Number(selectedGif.media_formats.mp4.dims[1]),
                    width: Number(selectedGif.media_formats.mp4.dims[0]),
                    url: selectedGif.media_formats.mp4.url,
                    mimeType: "video/mp4",
                },
                mobile: {
                    height: Number(selectedGif.media_formats.tinygif.dims[1]),
                    width: Number(selectedGif.media_formats.tinygif.dims[0]),
                    url: selectedGif.media_formats.tinygif.url,
                    mimeType: "image/gif",
                },
                caption: message === "" ? undefined : message,
            };
            dispatch("sendMessageWithContent", { content });
            open = false;
        }
    }

    function selectGif(gif: KeyedTenorObject) {
        selectedGif = gif;
    }

    function clearSelectedGif() {
        selectedGif = undefined;
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
</script>

{#if open}
    <Overlay dismissible>
        <ModalContent large bind:actualWidth={modalWidth}>
            <div class="header" slot="header">
                <div class="title">
                    <Translatable resourceKey={i18nKey("sendGif")} />
                </div>
                <div class="gif-search">
                    <Input
                        maxlength={100}
                        type={"text"}
                        autofocus
                        countdown
                        placeholder={i18nKey("search")}
                        on:change={onChange}
                        value={searchTerm} />
                </div>
            </div>
            <form slot="body" class="gif-body" on:submit|preventDefault={send}>
                {#if selectedImage !== undefined}
                    <div class="selected">
                        <img
                            class:landscape={selectedImage.dims[0] > selectedImage.dims[1]}
                            src={selectedImage.url}
                            alt={selectedGif?.title} />
                    </div>
                {:else}
                    <div class="giphy-container" on:scroll={onScroll} bind:this={containerElement}>
                        {#each Object.values(gifCache) as item (item.key)}
                            <img
                                class="thumb"
                                on:click={() => selectGif(item)}
                                src={item.media_formats.tinygif.url}
                                style={`width: ${imgWidth}px; top: ${item.top}px; left: ${item.left}px`}
                                alt={item.title} />
                        {/each}
                    </div>
                {/if}
                {#if selectedGif === undefined}
                    <div class="powered-by">
                        <img src="/assets/powered_by_tenor.svg" alt="Powered by Tenor" />
                    </div>
                {/if}
                <div class="message">
                    <Input
                        maxlength={100}
                        type={"text"}
                        autofocus={false}
                        countdown
                        placeholder={i18nKey("tokenTransfer.messagePlaceholder")}
                        bind:value={message} />
                </div>
            </form>
            <span class="footer" slot="footer" class:selected={selectedGif !== undefined}>
                {#if selectedGif !== undefined}
                    <span class="close">
                        <Link underline={"always"} on:click={clearSelectedGif}>
                            <Translatable resourceKey={i18nKey("backToResults")} />
                        </Link>
                    </span>
                {/if}
                <ButtonGroup align={$mobileWidth ? "center" : "end"}>
                    <Button tiny disabled={selectedGif === undefined} on:click={send}
                        ><Translatable resourceKey={i18nKey("send")} /></Button>
                    <Button tiny secondary on:click={() => (open = false)}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    :global(.gif-body .input-wrapper) {
        margin-bottom: 0;
    }

    .giphy-container {
        overflow: auto;
        position: relative;
        height: calc(var(--vh, 1vh) * 60);

        @include mobile() {
            height: calc(var(--vh, 1vh) * 50);
        }
    }

    :global(.gif-search .input-wrapper) {
        margin-bottom: 0;
    }

    .powered-by {
        text-align: center;
        background-color: black;
        padding: $sp3 0;

        img {
            max-width: 300px;
            @include mobile() {
                max-width: 200px;
            }
        }
    }

    .header {
        display: flex;
        gap: $sp4;
        align-items: center;

        .gif-search {
            flex: auto;
        }
    }

    .selected {
        display: flex;
        justify-content: center;
        align-items: center;

        img {
            display: block;
            width: 100%;
            max-width: 100%;
            height: auto;
            max-height: calc(var(--vh, 1vh) * 50);

            &:not(.landscape) {
                width: auto;
            }
        }
    }

    .gif-body {
        position: relative;

        .thumb {
            position: absolute;
            cursor: pointer;
            display: block;
        }

        .message {
            padding-top: $sp3;
        }
    }

    .footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;

        &.selected {
            justify-content: space-between;
        }

        @include mobile() {
            justify-content: center;
        }
    }
</style>
