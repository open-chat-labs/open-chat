<script lang="ts">
    import { onMount, tick, type Snippet } from "svelte";
    import { fade } from "svelte/transition";
    import Button from "./Button.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import HoverIcon from "./HoverIcon.svelte";
    import { rtlStore } from "../stores/rtl";
    import { mobileWidth } from "../stores/screenDimensions";
    import { menuStore } from "../stores/menu";
    import { currentTheme } from "../theme/themes";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";

    type OnClose = (() => void) | undefined;

    interface Props {
        fill?: boolean;
        large?: boolean;
        hideHeader?: boolean;
        hideBody?: boolean;
        hideFooter?: boolean;
        compactFooter?: boolean;
        fadeDuration?: number;
        fadeDelay?: number;
        fixedWidth?: boolean;
        fitToContent?: boolean;
        alignTo?: DOMRect | undefined;
        actualWidth?: number;
        closeIcon?: boolean;
        square?: boolean;
        backgroundImage?: string | undefined;
        // if your modal *definitely* overflows on mobile you might need to set height explicitly
        overflows?: boolean;
        // It will probably overflow if you have a datetime picker in the modal!
        overflowVisible?: boolean;
        header?: Snippet<[OnClose]>;
        body?: Snippet<[OnClose]>;
        footer?: Snippet<[OnClose]>;
        onClose?: OnClose;
    }

    let {
        fill = false,
        large = false,
        hideHeader = false,
        hideBody = false,
        hideFooter = false,
        compactFooter = false,
        fadeDuration = 100,
        fadeDelay = 200,
        fixedWidth = true,
        fitToContent = false,
        alignTo = undefined,
        actualWidth = $bindable(0),
        closeIcon = false,
        square = false,
        backgroundImage = undefined,
        overflows = false,
        overflowVisible = false,
        header,
        body,
        footer,
        onClose,
    }: Props = $props();

    actualWidth;

    let divElement: HTMLElement;

    let useAlignTo = $derived(alignTo !== undefined && !$mobileWidth);
    let bgStyle = $derived(backgroundImage ? `--custom-bg: url(${backgroundImage});` : "");
    let position = $state("");
    let style = $derived(
        useAlignTo
            ? `${bgStyle} visibility: hidden; ${position}`
            : `${bgStyle} visibility: visible; ${position}`,
    );

    function closeMenus() {
        menuStore.hideMenu();
    }

    onMount(() => {
        try {
            if (useAlignTo) {
                tick().then(calculatePosition);
            }
            tick().then(() => (actualWidth = divElement?.clientWidth));
            divElement.addEventListener("click", closeMenus);
        } catch (e: any) {
            console.error("Failed to open modal", e);
            onClose?.();
        }
        return () => {
            divElement.removeEventListener("click", closeMenus);
        };
    });

    function calculatePosition() {
        if (alignTo !== undefined) {
            let modalRect = divElement.getBoundingClientRect();
            let top = Math.min(alignTo.top - 8, window.innerHeight - (modalRect.height + 10));

            position = `position: absolute; visibility: visible; top: ${top}px; `;

            if ($rtlStore) {
                let right = Math.min(
                    window.innerWidth - alignTo.left + 8,
                    window.innerWidth - modalRect.width - 10,
                );
                position += `right: ${right}px;`;
            } else {
                let left = Math.min(alignTo.right + 8, window.innerWidth - (modalRect.width + 10));
                position += `left: ${left}px;`;
            }
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    bind:this={divElement}
    {style}
    class:custom-bg={backgroundImage !== undefined}
    class="modal-content"
    class:square
    class:large
    class:overflows
    class:halloween={$currentTheme.name === "halloween"}
    in:fade={{ duration: fadeDuration, delay: fadeDelay }}
    out:fade={{ duration: fadeDuration }}
    class:fixed-width={fixedWidth}
    class:fit_to_content={fitToContent}>
    {#if !hideHeader}
        <div class="header">
            <h4>
                {@render header?.(onClose)}
            </h4>
            {#if closeIcon}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <span title={$_("close")} class="close" class:rtl={$rtlStore} onclick={onClose}>
                    <HoverIcon>
                        <Close size={"1em"} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
            {/if}
        </div>
    {/if}
    {#if !hideBody}
        <div class="body" class:fill class:overflow-visible={overflowVisible}>
            {@render body?.(onClose)}
        </div>
    {/if}
    {#if !hideFooter}
        <div class="footer" class:rtl={$rtlStore} class:compact={compactFooter}>
            {#if footer}{@render footer(onClose)}{:else}
                <Button on:click={() => onClose?.()} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    .modal-content.custom-bg::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: var(--custom-bg);
        background-size: cover;
        filter: contrast(0.8) sepia(0.5) grayscale(0.5);
        z-index: -1;
        border-radius: var(--modal-rd);
    }

    .modal-content {
        @include font-size(fs-100);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: var(--modal-bg);
        border: var(--modal-bd);
        border-radius: var(--modal-rd);
        position: relative;
        max-height: 100%;
        box-shadow: var(--modal-sh);
        background-repeat: no-repeat;
        background-size: cover;
        z-index: 1;

        &.halloween::after {
            @include cobweb();
            bottom: 4px;
            left: 4px;
            transform: scaleY(-1) scaleX(-1);
        }

        &.square {
            border-radius: $sp3;
        }

        @include mobile() {
            &:not(.fit_to_content) {
                width: 100%;
                max-height: calc(100% - 20px);
                border-radius: var(--modal-rd) var(--modal-rd) 0 0;
            }
            &.overflows {
                height: 100%;
            }
        }
        @include size-above(sm) {
            &.fixed-width {
                width: 60%;
            }
            &:not(.fit_to_content) {
                max-width: 576px;
            }
            &.large {
                &.fixed-width {
                    width: 90%;
                }
                max-width: 850px;
            }
        }
    }
    .header {
        @include font(bold, normal, fs-130, 29);
        padding: $sp4 $sp5;
        @include mobile() {
            @include font(bold, normal, fs-120, 29);
            padding: $sp3 $sp4;
            border-radius: $sp4 $sp4 0 0;
        }
    }

    .body {
        flex: 1;
        padding: $sp4 $sp5;
        overflow-y: auto;
        @include nice-scrollbar();

        &.fill {
            padding: 0;
        }

        @include mobile() {
            padding: $sp3 $sp4;
        }

        &.overflow-visible {
            overflow-y: visible;
        }
    }
    .footer {
        padding: $sp4 $sp5 $sp5 $sp5;
        &.compact {
            padding: $sp3 $sp4 $sp4 $sp4;
        }
        text-align: right;
        @include mobile() {
            padding: $sp3 $sp4 $sp4 $sp4;
            border-radius: 0;
        }
        &.rtl {
            text-align: left;
        }
    }

    .close {
        position: absolute;
        top: $sp3;
        &:not(.rtl) {
            right: $sp3;
        }
        &.rtl {
            left: $sp3;
        }
    }
</style>
