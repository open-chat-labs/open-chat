<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import {
        BRIDGE_PLATFORM_ICONS,
        bridgedAccountRows,
        linkBridgedAccount,
        openBridgedProfile,
    } from "@src/utils/bridgedAccounts";
    import {
        Body,
        BodySmall,
        ColourVars,
        Column,
        CommonButton,
        IconButton,
        Row,
    } from "component-lib";
    import {
        BRIDGE_PLATFORM_NAMES,
        bridgedAuthorName,
        bridgedProfileUrl,
        bridgedUserId,
        bridgedUserKey,
        i18nKey,
        OpenChat,
        type BridgedUserSummary,
        type BridgePlatform,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import LinkOff from "svelte-material-icons/LinkOff.svelte";
    import LinkVariant from "svelte-material-icons/LinkVariant.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    // Unset until the linked accounts have loaded, so no platform is offered before then
    let accounts: BridgedUserSummary[] | undefined = $state(undefined);
    let busy = $state(false);
    let rows = $derived(bridgedAccountRows(accounts));

    onMount(refresh);

    // Also run when the window regains focus, as the user links an account in another app
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

<SlidingPageContent title={i18nKey("bridgedAccounts.section")} subtitle={i18nKey("General options")}>
    <Column padding={["xxl", "lg"]} gap={"lg"} height={"fill"} crossAxisAlignment={"center"}>
        <Column gap={"xl"}>
            <Column padding={["zero", "lg"]}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("bridgedAccounts.info")}></Translatable>
                </BodySmall>
            </Column>

            <Column padding={["zero", "lg"]} gap={"md"}>
                {#each rows as row (row.platform)}
                    <Row gap={"md"} crossAxisAlignment={"center"} minHeight={"3rem"}>
                        <img
                            class="icon"
                            src={BRIDGE_PLATFORM_ICONS[row.platform]}
                            alt={BRIDGE_PLATFORM_NAMES[row.platform]} />
                        {#if row.kind === "linked"}
                            {@const profileUrl = bridgedProfileUrl(row.account.user)}
                            <Body
                                ellipsisTruncate
                                colour={profileUrl !== undefined ? "primary" : undefined}
                                onClick={profileUrl !== undefined
                                    ? () => openBridgedProfile(client, profileUrl)
                                    : undefined}>{bridgedAuthorName(row.account)}</Body>
                            <IconButton
                                size={"md"}
                                disabled={busy}
                                onclick={() => unlink(row.account)}>
                                {#snippet icon()}
                                    <LinkOff color={ColourVars.textSecondary} size="1.5rem" />
                                {/snippet}
                            </IconButton>
                        {:else if row.kind === "linkable"}
                            <CommonButton
                                disabled={busy}
                                onClick={() => link(row.platform)}
                                size={"medium"}
                                mode={"active"}>
                                {#snippet icon(color, size)}
                                    <LinkVariant {color} {size}></LinkVariant>
                                {/snippet}
                                <Translatable
                                    resourceKey={i18nKey("bridgedAccounts.link", {
                                        platform: BRIDGE_PLATFORM_NAMES[row.platform],
                                    })}></Translatable>
                            </CommonButton>
                        {:else if row.kind === "unavailable"}
                            <CommonButton disabled size={"medium"} mode={"active"}>
                                <Translatable resourceKey={i18nKey("bridgedAccounts.comingSoon")}
                                ></Translatable>
                            </CommonButton>
                        {/if}
                    </Row>
                {/each}
            </Column>
        </Column>
    </Column>
</SlidingPageContent>

<style lang="scss">
    .icon {
        flex: none;
        width: var(--avatar-sm);
        height: var(--avatar-sm);
    }
</style>
