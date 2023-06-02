<script lang="ts">
    import { sineIn } from "svelte/easing";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";

    import { fly } from "svelte/transition";
    import { toastStore, ToastType } from "../stores/toast";
    import { iconSize } from "../stores/iconSize";
</script>

{#if $toastStore}
    <div class="toast" transition:fly={{ y: 200, duration: 200, easing: sineIn }}>
        <div
            class="message"
            class:failure={$toastStore.type === ToastType.Failure}
            class:success={$toastStore.type === ToastType.Success}>
            <div class="text">{$_($toastStore.text, $toastStore.args)}</div>
            {#if $toastStore.type === ToastType.Failure}
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
        justify-content: center;
        align-items: center;
        color: var(--button-txt);
        @include mobile() {
            width: 100%;
        }

        &:hover {
            background-color: var(--button-hv);
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

        .close {
            flex: 0 0 30px;
            cursor: pointer;
        }
    }
</style>
