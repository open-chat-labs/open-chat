<script lang="ts">
    import { Body, ColourVars, Container, IconButton } from "component-lib";
    import type { Snippet } from "svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import { copyToClipboard } from "../../utils/urls";

    interface Props {
        account: string;
        disableCopy?: boolean;
        children?: Snippet;
    }

    let { account, disableCopy = false, children }: Props = $props();

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

<Container crossAxisAlignment={"center"} gap={"md"}>
    {@render children?.()}
    <Body fontWeight={"bold"}>
        {collapseAccount(account)}
    </Body>
    {#if !disableCopy}
        <IconButton onclick={copy}>
            {#snippet icon()}
                <ContentCopy color={ColourVars.primary} />
            {/snippet}
        </IconButton>
    {/if}
</Container>
