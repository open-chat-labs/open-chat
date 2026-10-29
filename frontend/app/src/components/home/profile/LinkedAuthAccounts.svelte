<script lang="ts">
    import {
        iconSize,
        OpenChat,
        shortSignInPrincipal,
        signInLastUsed,
        type LinkedAuthenticationPrincipal,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import { locale } from "svelte-i18n";
    import Account from "svelte-material-icons/Account.svelte";
    import LinkOff from "svelte-material-icons/LinkOff.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import TruncatedAccount from "../TruncatedAccount.svelte";
    import AuthProviderLogo from "./AuthProviderLogo.svelte";
    import LinkAccounts from "./LinkAccounts.svelte";
    import LinkAccountsModal from "./LinkAccountsModal.svelte";
    import UnlinkAccounts from "./UnlinkAccounts.svelte";

    const client = getContext<OpenChat>("client");

    let accounts: LinkedAuthenticationPrincipal[] = $state([]);
    let linking = $state(false);
    let unlinking: LinkedAuthenticationPrincipal | null = $state(null);

    onMount(() => refresh());

    async function refresh() {
        linking = false;
        unlinking = null;
        accounts = await client.getAuthenticationPrincipals();
    }
</script>

{#if linking}
    <Overlay onClose={refresh}>
        <LinkAccountsModal onClose={refresh}>
            <LinkAccounts
                explanations={[i18nKey("identity.linkedAccounts.linkAdvice")]}
                iiPrincipal={undefined}
                linkInternetIdentity={false}
                onProceed={refresh}
                onClose={refresh} />
        </LinkAccountsModal>
    </Overlay>
{/if}

{#if unlinking != null}
    <Overlay onClose={refresh}>
        <LinkAccountsModal onClose={refresh}>
            <UnlinkAccounts account={unlinking} onClose={refresh} />
        </LinkAccountsModal>
    </Overlay>
{/if}

<div class="accounts">
    {#each accounts as account}
        <div class="account">
            <TruncatedAccount account={shortSignInPrincipal(account.principal)} disableCopy={true}>
                <AuthProviderLogo square provider={account.provider} />
            </TruncatedAccount>
            {#if account.passkeyProvider !== undefined || account.lastUsed !== undefined}
                <div class="details">
                    {#if account.passkeyProvider !== undefined}
                        <div class="provider-name" title={account.passkeyProvider}>
                            {account.passkeyProvider}
                        </div>
                    {/if}
                    {#if account.lastUsed !== undefined}
                        <div class="last-used">
                            <Translatable
                                resourceKey={signInLastUsed(account.lastUsed, $locale ?? "en")} />
                        </div>
                    {/if}
                </div>
            {/if}
            {#if account.isCurrentIdentity}
                <div class="current">
                    <Tooltip position="top" align="end">
                        <Account size={$iconSize} color={"var(--icon-txt)"} />
                        {#snippet popupTemplate()}
                            <Translatable
                                resourceKey={i18nKey("identity.linkedAccounts.currentAccount")} />
                        {/snippet}
                    </Tooltip>
                </div>
            {:else}
                <div class="unlink">
                    <Tooltip position="top" align="end">
                        <HoverIcon onclick={() => (unlinking = account)}>
                            <LinkOff size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                        {#snippet popupTemplate()}
                            <Translatable resourceKey={i18nKey("identity.linkedAccounts.unlink")} />
                        {/snippet}
                    </Tooltip>
                </div>
            {/if}
        </div>
    {/each}
</div>

<Button onClick={() => (linking = true)}>
    <Translatable resourceKey={i18nKey("identity.linkedAccounts.linkAnother")} />
</Button>

<style lang="scss">
    // one grid for every row, so each row's details start after the longest principal
    .accounts {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: $sp3;
        margin-bottom: $sp3;
    }

    .account {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
        align-items: center;

        .details {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }

        .provider-name,
        .last-used {
            @include font(book, normal, fs-80);
            @include ellipsis();
            color: var(--txt-light);
        }

        .current,
        .unlink {
            // the last column, also in a row with no details
            grid-column: 3;
        }
    }
</style>
