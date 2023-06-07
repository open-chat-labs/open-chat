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
    import type { GIFObject, PagedGIFObject, SearchResponse, GiphyContent } from "openchat-client";

    const dispatch = createEventDispatcher();

    export let open: boolean;

    let refreshing = false;
    let message = "";
    let searchTerm = "";
    let gifs: PagedGIFObject[] = [];
    let gifCache: Record<
        string,
        PagedGIFObject & { top: number; left: number; calculatedHeight: number }
    > = {};
    let timer: number | undefined;
    let modalWidth = 0;
    let pageSize = 25;
    let pageNum = -1;
    let selectedGif: PagedGIFObject | undefined;
    let containerElement: HTMLDivElement;
    const gutter = 5;
    let imgWidth = 0;

    $: selectedImage =
        selectedGif === undefined
            ? undefined
            : $mobileWidth
            ? { ...selectedGif.images.downsized_large }
            : { ...selectedGif.images.original };

    const TRENDING_API_URL = `https://api.giphy.com/v1/gifs/trending?api_key=${process.env.GIPHY_APIKEY}&limit=${pageSize}`;
    const SEARCH_API_URL = `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_APIKEY}&limit=${pageSize}&q=`;

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
            PagedGIFObject & { top: number; left: number; calculatedHeight: number }
        >,
        row: number,
        col: number
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
            PagedGIFObject & { top: number; left: number; calculatedHeight: number }
        >,
        gif: PagedGIFObject,
        i: number
    ): Record<string, PagedGIFObject & { top: number; left: number; calculatedHeight: number }> {
        const col = i % numCols;
        const row = Math.floor(i / numCols);
        const scale = gif.images.fixed_width.width / imgWidth;
        const calcHeight = gif.images.fixed_width.height / scale;
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
                pageNum = -1;
                reset(searchTerm);
            }
        }, 500);
    }

    function addPagingInfo(index: number, pageNum: number, gif: GIFObject): PagedGIFObject {
        return {
            groupKey: pageNum,
            key: index + pageNum * pageSize,
            ...gif,
        };
    }

    function getMoreGifs() {
        refreshing = true;
        const offset = pageSize * pageNum;
        const url =
            searchTerm === ""
                ? `${TRENDING_API_URL}&offset=${offset}`
                : `${SEARCH_API_URL}${searchTerm}&offset=${offset}`;
        return fetch(url)
            .then((res) => res.json())
            .then((res: SearchResponse) => {
                return res.data;
            })
            .then((res) => res.map((gif, i) => addPagingInfo(i, pageNum, gif)))
            .finally(() => (refreshing = false));
    }

    export function reset(search: string) {
        message = "";
        searchTerm = search;
        selectedGif = undefined;
        gifs = [];
        nextPage();
    }

    function send() {
        if (selectedGif !== undefined) {
            const content: GiphyContent = {
                kind: "giphy_content",
                title: selectedGif.title,
                desktop: {
                    height: Number(selectedGif.images.original.height),
                    width: Number(selectedGif.images.original.width),
                    url: selectedGif.images.original.mp4,
                    mimeType: "video/mp4",
                },
                mobile: {
                    height: Number(selectedGif.images.downsized.height),
                    width: Number(selectedGif.images.downsized.width),
                    url: selectedGif.images.downsized.url,
                    mimeType: "image/gif",
                },
            };
            dispatch("sendGiphy", [content, message === "" ? undefined : message]);
            open = false;
        }
    }

    function selectGif(gif: PagedGIFObject) {
        selectedGif = gif;
    }

    function clearSelectedGif() {
        selectedGif = undefined;
    }

    async function nextPage() {
        if (refreshing) return;
        pageNum = pageNum + 1;
        const nextPage = await getMoreGifs();
        gifs = [...gifs, ...nextPage];
    }

    function onScroll() {
        if (containerElement) {
            if (
                Math.abs(
                    containerElement.scrollHeight -
                        containerElement.clientHeight -
                        containerElement.scrollTop
                ) < 200
            ) {
                nextPage();
            }
        }
    }
</script>

{#if open}
    <Overlay dismissible={true}>
        <ModalContent large={true} bind:actualWidth={modalWidth}>
            <div class="header" slot="header">
                <div class="title">
                    {$_("sendGif")}
                </div>
                <div class="gif-search">
                    <Input
                        maxlength={100}
                        type={"text"}
                        autofocus={true}
                        countdown={true}
                        placeholder={$_("search")}
                        on:change={onChange}
                        value={searchTerm} />
                </div>
            </div>
            <form slot="body" class="gif-body" on:submit|preventDefault={send}>
                {#if selectedImage !== undefined}
                    <div class="selected">
                        <img
                            class:landscape={selectedImage.width > selectedImage.height}
                            src={selectedImage.url}
                            alt={selectedGif?.title} />
                    </div>
                {:else}
                    <div class="giphy-container" on:scroll={onScroll} bind:this={containerElement}>
                        {#each Object.values(gifCache) as item (item.key)}
                            <img
                                class="thumb"
                                on:click={() => selectGif(item)}
                                src={item.images.fixed_width.url}
                                style={`width: ${imgWidth}px; top: ${item.top}px; left: ${item.left}px`}
                                alt={item.title} />
                        {/each}
                    </div>
                {/if}

                {#if selectedGif === undefined}
                    <div class="powered-by">
                        <img src="../assets/giphy_small.gif" alt="Powered by Giphy" />
                    </div>
                {/if}

                <div class="message">
                    <Input
                        maxlength={100}
                        type={"text"}
                        autofocus={false}
                        countdown={true}
                        placeholder={$_("tokenTransfer.messagePlaceholder")}
                        bind:value={message} />
                </div>
            </form>
            <span class="footer" slot="footer" class:selected={selectedGif !== undefined}>
                {#if selectedGif !== undefined}
                    <span class="close">
                        <Link underline={"always"} on:click={clearSelectedGif}>
                            {$_("backToResults")}
                        </Link>
                    </span>
                {/if}
                <ButtonGroup align={$mobileWidth ? "center" : "end"}>
                    <Button tiny={true} disabled={selectedGif === undefined} on:click={send}
                        >{$_("send")}</Button>
                    <Button tiny={true} secondary={true} on:click={() => (open = false)}
                        >{$_("cancel")}</Button>
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
