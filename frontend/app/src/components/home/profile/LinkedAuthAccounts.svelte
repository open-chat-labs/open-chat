<script lang="ts">
    import Account from "svelte-material-icons/Account.svelte";
    import LinkOff from "svelte-material-icons/LinkOff.svelte";
    import { AuthProvider, OpenChat, type AuthenticationPrincipal } from "openchat-client";
    import { getContext } from "svelte";
    import TruncatedAccount from "../TruncatedAccount.svelte";
    import AuthProviderLogo from "./AuthProviderLogo.svelte";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { iconSize } from "../../../stores/iconSize";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import LinkAccountsModal from "./LinkAccountsModal.svelte";
    import Overlay from "../../Overlay.svelte";
    import LinkAccounts from "./LinkAccounts.svelte";
    import UnlinkAccounts from "./UnlinkAccounts.svelte";
    import HoverIcon from "../../HoverIcon.svelte";

    const client = getContext<OpenChat>("client");

    type AccountType = AuthenticationPrincipal & { provider: AuthProvider };

    let accounts: AccountType[] = $state([]);
    let linking = $state(false);
    let unlinking: AccountType | null = $state(null);

    $effect(() => {
        (async () => refresh())();
    });

    async function refresh() {
        linking = false;
        unlinking = null;
        accounts = await client.getAuthenticationPrincipals();
    }
</script>

{#if linking}
    <Overlay>
        <LinkAccountsModal on:close={refresh}>
            <LinkAccounts
                explanations={[i18nKey("identity.linkedAccounts.linkAdvice")]}
                iiPrincipal={undefined}
                linkInternetIdentity={false}
                onProceed={refresh}
                on:close={refresh} />
        </LinkAccountsModal>
    </Overlay>
{/if}

{#if unlinking != null}
    <Overlay>
        <LinkAccountsModal on:close={refresh}>
            <UnlinkAccounts account={unlinking} onClose={refresh} />
        </LinkAccountsModal>
    </Overlay>
{/if}

{#each accounts as account}
    <div class="account">
        <TruncatedAccount account={account.principal}>
            <AuthProviderLogo square provider={account.provider} />
        </TruncatedAccount>
        {#if account.isCurrentIdentity}
            <div class="current">
                <TooltipWrapper position="top" align="end">
                    <Account slot="target" size={$iconSize} color={"var(--icon-txt)"} />
                    <div let:position let:align slot="tooltip">
                        <TooltipPopup {position} {align}>
                            <Translatable
                                resourceKey={i18nKey("identity.linkedAccounts.currentAccount")} />
                        </TooltipPopup>
                    </div>
                </TooltipWrapper>
            </div>
        {:else}
            <div class="unlink">
                <TooltipWrapper position="top" align="end">
                    <HoverIcon slot="target" onclick={() => (unlinking = account)}>
                        <LinkOff size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                    <div let:position let:align slot="tooltip">
                        <TooltipPopup {position} {align}>
                            <Translatable resourceKey={i18nKey("identity.linkedAccounts.unlink")} />
                        </TooltipPopup>
                    </div>
                </TooltipWrapper>
            </div>
        {/if}
    </div>
{/each}

<Button on:click={() => (linking = true)}>
    <Translatable resourceKey={i18nKey("identity.linkedAccounts.linkAnother")} />
</Button>

<style lang="scss">
    .account {
        margin-bottom: $sp3;
        display: flex;
        align-items: center;

        .current,
        .unlink {
            margin-inline-start: auto;
        }
    }
</style>
