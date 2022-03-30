<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Input from "../Input.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, onMount, tick } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import type { GIFObject, PaginationObject, SearchResponse } from "../../domain/giphy";
    import { debug } from "../../utils/logging";

    const dispatch = createEventDispatcher();

    const TRENDING_API_URL = `https://api.giphy.com/v1/gifs/trending?api_key=${process.env.GIPHY_APIKEY}&limit=50`;
    const SEARCH_API_URL = `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_APIKEY}&limit=50&q=`;
    const THRESHOLD = 1000;

    export let open: boolean;

    let giphyGridEl: HTMLElement;

    let refreshing = false;
    let error: string | undefined = undefined;
    let message = "";
    let searchTerm = "";
    let gifs: GIFObject[] = [];
    let timer: number | undefined;
    let pagination: PaginationObject | undefined = undefined;
    let gridElement: HTMLDivElement;
    let masonrySupported = false;

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
                pagination = undefined;
                reset(searchTerm);
            }
        }, 500);
    }

    function onScroll() {
        if (!refreshing && giphyGridEl.scrollHeight - giphyGridEl.scrollTop < THRESHOLD) {
            if (pagination !== undefined && pagination.offset < pagination.total_count) {
                reset(searchTerm);
            }
        }
    }

    function renderGrid(recursing = false) {
        if (masonrySupported) return;

        const style = getComputedStyle(gridElement);
        const gap = parseFloat(style.gridRowGap);
        const items = [...gridElement.childNodes].filter(
            (c) => c.nodeType === 1
        ) as HTMLImageElement[];
        const ncol = style.gridTemplateColumns.split(" ").length;

        items.forEach((item) => {
            item.style.removeProperty("margin-top");
        });

        if (ncol > 1) {
            items.slice(ncol).forEach((c, i) => {
                let prev_fin =
                        items[i].getBoundingClientRect().bottom /* bottom edge of item above */,
                    curr_ini = c.getBoundingClientRect().top; /* top edge of current item */

                c.style.marginTop = `${prev_fin + gap - curr_ini}px`;
            });
        }

        if (!recursing) {
            renderGrid(true);
        }
    }

    export function reset(search: string) {
        tick().then(() => {
            const style = getComputedStyle(gridElement);
            masonrySupported = style.gridTemplateRows === "masonry";
            refreshing = true;
            error = undefined;
            message = "";
            searchTerm = search;
            gifs = pagination === undefined ? [] : gifs;
            const url =
                searchTerm === ""
                    ? `${TRENDING_API_URL}&offset=${pagination?.offset ?? 0}`
                    : `${SEARCH_API_URL}${searchTerm}&offset=${pagination?.offset ?? 0}`;
            fetch(url)
                .then((res) => res.json())
                .then(debug)
                .then((res: SearchResponse) => {
                    pagination = {
                        offset: res.pagination.count + (pagination?.count ?? 0),
                        total_count: res.pagination.total_count,
                        count: res.pagination.count,
                    };
                    return res.data;
                })
                .then((res) => (gifs = [...gifs, ...res]))
                .then(() => window.setTimeout(renderGrid, 1000))
                .finally(() => (refreshing = false));
        });
    }

    function send() {
        // create a new type of message content maybe to contain the giphy url, let's wait and see how that pans out
        const content = {
            kind: "giphy_content",
            caption: message === "" ? undefined : message,
        };
        dispatch("sendGiphy", content);
        open = false;
    }

    function selectGif(gif: GIFObject) {
        console.log("selected: ", gif);
    }
</script>

<svelte:window on:resize={() => renderGrid(true)} />

<Overlay dismissible={true} bind:active={open}>
    <ModalContent>
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
        <form slot="body" class="gif-body" on:submit={send}>
            <div on:scroll={onScroll} bind:this={giphyGridEl} class="result-wrapper">
                <div bind:this={gridElement} class="grid--masonry">
                    {#each gifs as gif}
                        <img
                            on:click={() => selectGif(gif)}
                            class="thumb"
                            src={gif.images.fixed_height.url}
                            alt={gif.title} />
                    {/each}
                </div>
            </div>

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
        <span class="footer" slot="footer">
            <ButtonGroup align={$mobileWidth ? "center" : "end"}>
                <Button tiny={true} on:click={send}>{$_("send")}</Button>
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

    :global(.gif-search .input-wrapper) {
        margin-bottom: 0;
    }

    $col-width: Min(10em, 100%);
    $gap: $sp3;

    .header {
        display: flex;
        gap: $sp4;
        align-items: center;

        .gif-search {
            flex: auto;
        }
    }

    .gif-body {
        position: relative;

        .result-wrapper {
            overflow: auto;
            height: calc(var(--vh, 1vh) * 50);
        }

        .grid--masonry {
            justify-content: center;
            grid-gap: $gap;
            padding: $gap;
            display: grid;
            grid-template-columns: repeat(auto-fit, $col-width);

            // todo - this is only supported on firefox so far
            // for other browsers, we need a js fallback
            grid-template-rows: masonry;

            > * {
                width: $col-width;
            }
        }
        .thumb {
            cursor: pointer;
            display: block;
            // width: 100%;
        }
        .message {
            padding-top: $sp3;
            background-color: #fff;
        }
    }

    .footer {
    }
</style>
