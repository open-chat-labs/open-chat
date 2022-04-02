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
    import type { GIFObject, PagedGIFObject, SearchResponse } from "../../domain/giphy";
    import { MasonryInfiniteGrid } from "@egjs/svelte-infinitegrid";
    import type { GiphyContent } from "domain/chat/chat";

    const dispatch = createEventDispatcher();

    export let open: boolean;

    let refreshing = false;
    let message = "";
    let searchTerm = "";
    let gifs: PagedGIFObject[] = [];
    let timer: number | undefined;
    let modalWidth = 0;
    let pageSize = 25;
    let pageNum = -1;
    let selectedGif: PagedGIFObject | undefined;

    $: selectedImage =
        selectedGif === undefined
            ? undefined
            : $mobileWidth
            ? { ...selectedGif.images.downsized_large, type: "gif" }
            : {
                  ...selectedGif.images.original,
                  url: selectedGif.images.original.mp4,
                  type: "mp4",
              };

    const TRENDING_API_URL = `https://api.giphy.com/v1/gifs/trending?api_key=${process.env.GIPHY_APIKEY}&limit=${pageSize}`;
    const SEARCH_API_URL = `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_APIKEY}&limit=${pageSize}&q=`;

    $: availWidth = modalWidth - 32; // 32 is the padding
    $: numCols = $mobileWidth ? 2 : 4;
    $: imgWidth = availWidth / numCols - 5; // 5 is the col gap

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
    }

    function send() {
        if (selectedGif !== undefined) {
            const content: GiphyContent = {
                kind: "giphy_content",
                caption: message === "" ? undefined : message,
                title: selectedGif.title,
                desktop: {
                    height: Number(selectedGif.images.original.height),
                    width: Number(selectedGif.images.original.width),
                    url: selectedGif.images.original.mp4,
                },
                mobile: {
                    height: Number(selectedGif.images.downsized_large.height),
                    width: Number(selectedGif.images.downsized_large.width),
                    url: selectedGif.images.downsized_large.url,
                },
            };
            dispatch("sendGiphy", content);
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

    function getItemData(item: any): PagedGIFObject {
        return item.data;
    }

    function getItemKey(item: any): number {
        return item.key;
    }
</script>

<Overlay dismissible={true} bind:active={open}>
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
                    {#if selectedImage.type === "gif"}
                        <img
                            class:landscape={selectedImage.width > selectedImage.height}
                            src={selectedImage.url}
                            alt={selectedGif?.title} />
                    {:else if selectedImage.type === "mp4"}
                        <video
                            title={selectedGif?.title}
                            class:landscape={selectedImage.width > selectedImage.height}
                            autoplay={true}
                            muted={true}
                            loop={true}
                            class="thumb">
                            <track kind="captions" />
                            <source src={selectedImage.url} type="video/mp4" />
                        </video>
                    {/if}
                </div>
            {:else}
                <MasonryInfiniteGrid
                    threshold={500}
                    isConstantSize={true}
                    container={true}
                    class="giphy-container"
                    gap={5}
                    on:requestAppend={({ detail: e }) => {
                        e.wait();
                        nextPage().then(() => e.ready());
                    }}
                    items={gifs}
                    let:visibleItems>
                    {#each visibleItems as item (getItemKey(item))}
                        <video
                            title={getItemData(item).title}
                            autoplay={true}
                            muted={true}
                            loop={true}
                            style={`width: ${imgWidth}px`}
                            on:click={() => selectGif(getItemData(item))}
                            class="thumb">
                            <track kind="captions" />
                            <source
                                src={getItemData(item).images.fixed_width.mp4}
                                type="video/mp4" />
                            <source
                                src={getItemData(item).images.fixed_width.webp}
                                type="video/webp" />
                        </video>
                    {/each}
                </MasonryInfiniteGrid>
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
                    placeholder={$_("icpTransfer.messagePlaceholder")}
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

<style type="text/scss">
    :global(.gif-body .input-wrapper) {
        margin-bottom: 0;
    }

    :global(.giphy-container) {
        overflow: auto;
        height: calc(var(--vh, 1vh) * 60);
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
            cursor: pointer;
            display: block;
        }

        .message {
            padding-top: $sp3;
            background-color: #fff;
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
