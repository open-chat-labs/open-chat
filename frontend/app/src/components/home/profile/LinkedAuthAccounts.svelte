<script lang="ts">
    import {
        iconSize,
        OpenChat,
        type LinkedAuthenticationPrincipal,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import Account from "svelte-material-icons/Account.svelte";
    import LinkOff from "svelte-material-icons/LinkOff.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
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

{#each accounts as account}
    <div class="account">
        <TruncatedAccount account={account.principal} disableCopy={true}>
            <AuthProviderLogo square provider={account.provider} />
        </TruncatedAccount>
        {#if account.passkeyProvider !== undefined}
            <div class="provider-name" title={account.passkeyProvider}>
                {account.passkeyProvider}
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

<Button onClick={() => (linking = true)}>
    <Translatable resourceKey={i18nKey("identity.linkedAccounts.linkAnother")} />
</Button>

<style lang="scss">
    .account {
        margin-bottom: $sp3;
        display: flex;
        align-items: center;

        > :global(.wrapper) {
            flex: none;
        }

        .provider-name {
            @include font(book, normal, fs-80);
            @include ellipsis();
            flex: 0 1 auto;
            min-width: 0;
            color: var(--txt-light);
            margin-inline-start: $sp3;
        }

        .current,
        .unlink {
            flex: none;
            margin-inline-start: auto;
        }
    }
</style>
