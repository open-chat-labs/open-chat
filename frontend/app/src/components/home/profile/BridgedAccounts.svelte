<script lang="ts">
    import {
        AvatarSize,
        BRIDGE_PLATFORM_NAMES,
        bridgedAuthorName,
        bridgedUserId,
        bridgedUserKey,
        iconSize,
        OpenChat,
        type BridgedUserSummary,
        type BridgePlatform,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import LinkOff from "svelte-material-icons/LinkOff.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import { linkBridgedAccount, platformsToLink } from "../../../utils/bridgedAccounts";
    import Avatar from "../../Avatar.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import BotBadge from "./BotBadge.svelte";

    const client = getContext<OpenChat>("client");

    // Unset until the linked accounts have loaded, so no platform is offered before then
    let accounts: BridgedUserSummary[] | undefined = $state(undefined);
    let busy = $state(false);
    let unlinkedPlatforms = $derived(accounts === undefined ? [] : platformsToLink(accounts));

    onMount(refresh);

    // Also run when the window regains focus, as the user links an account in another tab or app
    function refresh() {
        client
            .getLinkedBridgedUsers()
            .then((linked) => (accounts = linked))
            // Offer linking even if the linked accounts couldn't be loaded
            .catch(() => (accounts ??= []));
    }

    async function link(platform: BridgePlatform) {
        busy = true;
        const sent = await linkBridgedAccount(client, platform).finally(() => (busy = false));
        if (!sent) {
            toastStore.showFailureToast(
                i18nKey("bridgedAccounts.linkFailed", { platform: BRIDGE_PLATFORM_NAMES[platform] }),
            );
        }
    }

    async function unlink(account: BridgedUserSummary) {
        busy = true;
        const id = bridgedUserId(account.user);
        const resp = await client
            .unlinkBridgedUser(id)
            .catch(() => undefined)
            .finally(() => (busy = false));
        if (resp?.kind === "success") {
            accounts = accounts?.filter((a) => bridgedUserKey(bridgedUserId(a.user)) !== bridgedUserKey(id));
        } else {
            toastStore.showFailureToast(i18nKey("bridgedAccounts.unlinkFailed"));
        }
    }
</script>

<svelte:window onfocus={refresh} />

<p class="info">
    <Translatable resourceKey={i18nKey("bridgedAccounts.info")} />
</p>

{#each accounts ?? [] as account (bridgedUserKey(bridgedUserId(account.user)))}
    {@const id = bridgedUserId(account.user)}
    <div class="account">
        <Avatar url={client.bridgedAvatarUrl(id, account)} size={AvatarSize.Small} />
        <div class="name">{bridgedAuthorName(account)}</div>
        <BotBadge bridge={id.kind} />
        <div class="unlink">
            <Tooltip position="top" align="end">
                <HoverIcon onclick={() => unlink(account)}>
                    <LinkOff size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
                {#snippet popupTemplate()}
                    <Translatable resourceKey={i18nKey("bridgedAccounts.unlink")} />
                {/snippet}
            </Tooltip>
        </div>
    </div>
{/each}

{#if unlinkedPlatforms.length > 0}
    <ButtonGroup align="start">
        {#each unlinkedPlatforms as platform}
            <Button disabled={busy} onClick={() => link(platform)}>
                <Translatable
                    resourceKey={i18nKey("bridgedAccounts.link", {
                        platform: BRIDGE_PLATFORM_NAMES[platform],
                    })} />
            </Button>
        {/each}
    </ButtonGroup>
{/if}

<style lang="scss">
    .info {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }

    .account {
        margin-bottom: $sp3;
        display: flex;
        align-items: center;
        gap: $sp3;

        .name {
            @include ellipsis();
            flex: 0 1 auto;
            min-width: 0;
        }

        .unlink {
            flex: none;
            margin-inline-start: auto;
        }
    }
</style>
