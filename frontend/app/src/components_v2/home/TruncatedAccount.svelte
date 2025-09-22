<script lang="ts">
    import { iconSize } from "openchat-client";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import { copyToClipboard } from "../../utils/urls";

    interface Props {
        account: string;
        centered?: boolean;
        disableCopy?: boolean;
        children?: Snippet;
    }

    let { account, centered = false, disableCopy = false, children }: Props = $props();

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function copy() {
        copyToClipboard(account).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("accountCopiedToClipboard"));
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
    {@render children?.()}
    <div class="principal">
        {collapseAccount(account)}
    </div>
    {#if !disableCopy}
        <div class="copy" title={$_("copyToClipboard")} onclick={copy}>
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
            display: flex;
            cursor: pointer;
        }
    }
</style>
