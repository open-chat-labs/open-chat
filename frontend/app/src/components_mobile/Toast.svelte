<script lang="ts">
    import { Tooltip } from "component-lib";
    import {
        type ChatIdentifier,
        iconSize,
        localUpdates,
        routeForChatIdentifier,
        subscribe,
    } from "openchat-client";
    import page from "page";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Bug from "svelte-material-icons/Bug.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { sineIn } from "svelte/easing";
    import { fly } from "svelte/transition";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import { toastStore } from "../stores/toast";
    import Translatable from "./Translatable.svelte";

    let reactiveResourceKey = $derived($toastStore?.resourceKey);

    function report() {
        if (
            $toastStore &&
            $toastStore.kind === "failure" &&
            $toastStore.err !== undefined &&
            $reactiveResourceKey !== undefined
        ) {
            const msg = interpolate($_, $reactiveResourceKey);
            const withDetail = `${msg} (${$toastStore.err})`;
            const chatId = {
                kind: "channel",
                communityId: "dgegb-daaaa-aaaar-arlhq-cai",
                channelId: 2235218862,
            } as ChatIdentifier;
            page(routeForChatIdentifier("community", chatId));
            localUpdates.draftMessages.setTextContent({ chatId }, withDetail);
            toastStore.hideToast();
        }
    }

    onMount(() => {
        const unsubs = [
            subscribe("showFailureToast", ({ resourceKey, err }) =>
                toastStore.showFailureToast(resourceKey, err),
            ),
            subscribe("showSuccessToast", (resourceKey) =>
                toastStore.showSuccessToast(resourceKey),
            ),
        ];
        return () => {
            unsubs.forEach((u) => u());
        };
    });
</script>

{#if $toastStore && $reactiveResourceKey}
    <div class="toast" transition:fly={{ y: 200, duration: 200, easing: sineIn }}>
        <div
            class="message"
            class:failure={$toastStore.kind === "failure"}
            class:success={$toastStore.kind === "success"}>
            <div class="text"><Translatable resourceKey={$reactiveResourceKey} /></div>
            {#if $toastStore.kind === "failure"}
                {#if $toastStore.err !== undefined}
                    <Tooltip position="top" align="middle">
                        <div class="report" onclick={report}>
                            <Bug size={$iconSize} color={"var(--button-txt)"} />
                        </div>
                        {#snippet popup()}
                            <Translatable resourceKey={i18nKey("reportBug")} />
                        {/snippet}
                    </Tooltip>
                {/if}
                <div class="close" onclick={toastStore.hideToast}>
                    <Close size={$iconSize} color={"var(--button-txt)"} />
                </div>
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .toast {
        position: fixed;
        bottom: $sp7;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        @include z-index("toast");
    }

    .message {
        transition: background 200ms ease-in-out;
        background: var(--success);
        border-radius: var(--rad-md);
        padding: $sp4;
        max-width: 800px;
        margin: 0 $sp4;
        display: flex;
        gap: $sp4;
        justify-content: center;
        align-items: center;
        color: var(--text-primary);
        width: 100%;

        &.failure {
            background: var(--error);
        }

        .text {
            text-align: center;
            flex: auto;
        }

        &.success {
            background: var(--success);
        }

        .close,
        .report {
            flex: 0 0 30px;
            cursor: pointer;
        }
    }
</style>
