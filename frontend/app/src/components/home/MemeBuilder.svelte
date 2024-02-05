<script lang="ts">
    import { start } from "@memefighter/maker-core";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import MemeFighter from "../icons/MemeFighter.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { createEventDispatcher, tick } from "svelte";
    import type { MemeFighterContent as MemeFighterContentType } from "openchat-client";
    import { currentTheme } from "../../theme/themes";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const dispatch = createEventDispatcher();

    export let open: boolean;
    export let width = 500;
    export let height = 400;

    let memeUrl = undefined as string | undefined;
    let iframe: HTMLIFrameElement;
    let img: HTMLImageElement | undefined;
    let placeholder = "/assets/memefighter.svg";

    export function reset() {
        memeUrl = undefined;
        tick().then(() => {
            if (iframe) {
                start({
                    iframe,
                    styleVariables,
                    skipInsertButton: true,
                }).then(onMemeCreated);
            }
        });
    }

    const styleVariables = {
        "--background-color": "#1b1c21",
        "--foreground-color": $currentTheme.txt,
        "--button-color": $currentTheme.button.bg,
    };

    function send() {
        if (memeUrl !== undefined && img !== undefined) {
            const rect = img.getBoundingClientRect();
            const content: MemeFighterContentType = {
                kind: "meme_fighter_content",
                url: memeUrl,
                width: rect.width,
                height: rect.height,
            };
            dispatch("sendMessageWithContent", { content });
            open = false;
        }
    }

    function close() {
        open = false;
    }

    function onMemeCreated(url: string) {
        memeUrl = url;
    }

    function error() {
        if (img) {
            img.src = placeholder;
        }
    }
</script>

{#if open}
    <Overlay dismissible>
        <ModalContent fill closeIcon on:close={close}>
            <div class="header" slot="header">
                <MemeFighter size={$iconSize} color={"var(--icon-txt)"} />
                <div class="title">Meme Fighter</div>
            </div>
            <div slot="body" class="meme-body">
                {#if memeUrl}
                    <img bind:this={img} class="meme" src={memeUrl} on:error={error} />
                {:else}
                    <iframe
                        bind:this={iframe}
                        {width}
                        {height}
                        style="border: none; max-width: 100%;" />
                {/if}
            </div>
            <span class="footer" slot="footer">
                <ButtonGroup align={$mobileWidth ? "center" : "end"}>
                    <Button tiny secondary on:click={reset}
                        ><Translatable resourceKey={i18nKey("reset")} /></Button>
                    <Button tiny secondary on:click={close}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button tiny disabled={memeUrl === undefined} on:click={send}
                        ><Translatable resourceKey={i18nKey("send")} /></Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .header {
        display: flex;
        gap: $sp4;
        align-items: center;
    }

    .meme {
        width: 100%;
    }

    .meme-body {
        min-height: 400px;
        background-color: #1b1c21;
        padding: $sp4 $sp5;
        text-align: center;
    }
</style>
