<script lang="ts">
    import { start } from "@memefighter/maker-core";
    import { Column, CommonButton, Row, Sheet, Subtitle } from "component-lib";
    import { iconSize, type MemeFighterContent as MemeFighterContentType } from "openchat-client";
    import { tick } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";
    import Translatable from "../Translatable.svelte";
    import MemeFighter from "../icons/MemeFighter.svelte";

    interface Props {
        open: boolean;
        width?: number;
        height?: number;
        onSend: (content: MemeFighterContentType) => void;
    }

    let { open = $bindable(), width = 500, height = 400, onSend }: Props = $props();

    let memeUrl = $state(undefined as string | undefined);
    let iframe: HTMLIFrameElement;
    let img: HTMLImageElement | undefined = $state();
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
            onSend(content);
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
    <Sheet onDismiss={close}>
        <Column gap={"lg"} padding={"lg"}>
            <Row crossAxisAlignment={"center"} gap={"sm"}>
                <MemeFighter size={$iconSize} color={"var(--icon-txt)"} />
                <Subtitle fontWeight={"bold"}>Meme Fighter</Subtitle>
            </Row>
            <Column minHeight={"25rem"} crossAxisAlignment={"center"} mainAxisAlignment={"center"}>
                {#if memeUrl}
                    <img bind:this={img} class="meme" src={memeUrl} onerror={error} />
                {:else}
                    <iframe
                        bind:this={iframe}
                        {width}
                        {height}
                        style="border: none; max-width: 100%;"></iframe>
                {/if}
            </Column>
            <Row mainAxisAlignment={"end"} gap={"md"} crossAxisAlignment={"center"}>
                <CommonButton size={"small_text"} onClick={reset}
                    ><Translatable resourceKey={i18nKey("reset")} /></CommonButton>
                <CommonButton size={"small_text"} onClick={close}
                    ><Translatable resourceKey={i18nKey("cancel")} /></CommonButton>
                <CommonButton
                    mode={"active"}
                    size={"medium"}
                    disabled={memeUrl === undefined}
                    onClick={send}>
                    <Translatable resourceKey={i18nKey("send")} />
                </CommonButton>
            </Row>
        </Column>
    </Sheet>
{/if}
