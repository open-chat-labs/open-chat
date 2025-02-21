<script lang="ts">
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { copyToClipboard } from "../../utils/urls";
    import { i18nKey } from "../../i18n/i18n";

    export let account: string;
    export let centered = false;
    export let disableCopy = false

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function copy() {
        copyToClipboard(account).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("copiedToClipboard"));
            } else {
                toastStore.showFailureToast(
                    i18nKey("failedToCopyToClipboard", {
                        account,
                    }),
                );
            }
        });
    }
</script>

<div class="wrapper" class:centered>
    <slot />
    <div class="principal">
        {collapseAccount(account)}
    </div>
    {#if !disableCopy}
        <div class="copy" title={$_("copyToClipboard")} on:click={copy}>
            <ContentCopy size={$iconSize} color={"var(--icon-txt)"} />
        </div>
    {/if}
</div>

<style lang="scss">
    .centered {
        text-align: center;
    }

    .wrapper {
        display: flex;
        align-items: center;
        gap: $sp3;
        .principal {
            @include ellipsis();
            @include font(book, normal, fs-80);
            color: var(--primary);
        }

        &.centered {
            justify-content: center;
        }

        .copy {
            cursor: pointer;
            width: 30px;
        }
    }
</style>
