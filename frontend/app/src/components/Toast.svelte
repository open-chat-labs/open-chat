<script lang="ts">
    import { sineIn } from "svelte/easing";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import Bug from "svelte-material-icons/Bug.svelte";
    import { fly } from "svelte/transition";
    import { toastStore, ToastType, type Toast } from "../stores/toast";
    import { iconSize } from "../stores/iconSize";
    import Translatable from "./Translatable.svelte";
    import { OpenChat, type ChatIdentifier, routeForChatIdentifier } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import page from "page";
    import TooltipWrapper from "./TooltipWrapper.svelte";
    import TooltipPopup from "./TooltipPopup.svelte";

    const client = getContext<OpenChat>("client");

    $: draftMessagesStore = client.draftMessagesStore;

    function report(toast: Toast | undefined) {
        if (toast && toast.type === ToastType.Failure && toast.err !== undefined) {
            const msg = interpolate($_, toast.resourceKey);
            const withDetail = `${msg} (${toast.err})`;
            const chatId = {
                kind: "channel",
                communityId: "dgegb-daaaa-aaaar-arlhq-cai",
                channelId: "20429314036340368324663327710074551214",
            } as ChatIdentifier;
            page(routeForChatIdentifier("community", chatId));
            draftMessagesStore.setTextContent({ chatId }, withDetail);
            toastStore.hideToast();
        }
    }
</script>

{#if $toastStore}
    <div class="toast" transition:fly={{ y: 200, duration: 200, easing: sineIn }}>
        <div
            class="message"
            class:failure={$toastStore.type === ToastType.Failure}
            class:success={$toastStore.type === ToastType.Success}>
            <div class="text"><Translatable resourceKey={$toastStore.resourceKey} /></div>
            {#if $toastStore.type === ToastType.Failure}
                {#if $toastStore.err !== undefined}
                    <TooltipWrapper position="top" align="middle">
                        <div slot="target" class="report" on:click={() => report($toastStore)}>
                            <Bug size={$iconSize} color={"var(--button-txt)"} />
                        </div>
                        <div let:position let:align slot="tooltip">
                            <TooltipPopup {align} {position}>
                                <Translatable resourceKey={i18nKey("reportBug")} />
                            </TooltipPopup>
                        </div>
                    </TooltipWrapper>
                {/if}
                <div class="close" on:click={toastStore.hideToast}>
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
        transition: background-color 200ms ease-in-out;
        background-color: var(--button-bg);
        padding: $sp4;
        width: 75%;
        max-width: 800px;
        margin: 0 $sp4;
        display: flex;
        gap: $sp4;
        justify-content: center;
        align-items: center;
        color: var(--button-txt);
        @include mobile() {
            width: 100%;
        }

        @media (hover: hover) {
            &:hover {
                background-color: var(--button-hv);
            }
        }

        &.failure {
            background-color: var(--toast-failure-bg);
            color: var(--toast-failure-txt);
        }

        .text {
            text-align: center;
            flex: auto;
        }

        &.success {
            background-color: var(--toast-success-bg);
            color: var(--toast-success-txt);
        }

        .close,
        .report {
            flex: 0 0 30px;
            cursor: pointer;
        }
    }
</style>
