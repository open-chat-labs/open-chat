<script lang="ts">
    import { onMount, getContext } from "svelte";
    import RefreshIcon from "svelte-material-icons/Refresh.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import QRCode from "../QRCode.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { _ } from "svelte-i18n";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Toggle from "../Toggle.svelte";
    import Link from "../Link.svelte";
    import { iconSize } from "../../stores/iconSize";
    import AreYouSure from "../AreYouSure.svelte";
    import { toastStore } from "../../stores/toast";
    import {
        type OpenChat,
        routeForChatIdentifier,
        type CommunitySummary,
        type CommunityIdentifier,
        type MultiUserChat,
        type MultiUserChatIdentifier,
        type ResourceKey,
        currentUser as user,
    } from "openchat-client";
    import { canShare, shareLink } from "../../utils/share";
    import Markdown from "./Markdown.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    export let container: MultiUserChat | CommunitySummary;

    const client = getContext<OpenChat>("client");
    const unauthorized = i18nKey("permissions.notPermitted", {
        permission: $_("permissions.inviteUsers"),
    });

    let ready = false;
    let code: string | undefined = undefined;
    let error: ResourceKey | undefined = undefined;
    let checked = false;
    let loading = false;
    let confirmReset = false;

    $: link = getLink(container.id, code);
    $: spinner = loading && code === undefined;

    function getLink(id: CommunityIdentifier | MultiUserChatIdentifier, code: string | undefined) {
        const qs = `/?ref=${$user.userId}` + (!container.public ? `&code=${code}` : "");
        switch (id.kind) {
            case "community":
                return `${window.location.origin}/community/${id.communityId}${qs}`;
            case "channel":
                return `${window.location.origin}${routeForChatIdentifier("community", id)}${qs}`;
            case "group_chat":
                return `${window.location.origin}${routeForChatIdentifier("group_chat", id)}${qs}`;
        }
    }

    export function init(container: MultiUserChat | CommunitySummary) {
        ready = false;
        if (container.public || container.kind === "channel") {
            ready = true;
            return;
        }
        loading = true;
        client
            .getInviteCode(container.id)
            .then((resp) => {
                if (resp.kind === "success") {
                    ready = true;
                    checked = resp.code !== undefined;
                    code = resp.code;
                } else if (resp.kind === "not_authorized") {
                    error = unauthorized;
                    client.logMessage("Unauthorized response calling getInviteCode");
                } else {
                    error = i18nKey("invite.errorGettingLink");
                }
            })
            .catch((err) => {
                error = i18nKey("invite.errorGettingLink");
                client.logError("Unable to get invite code: ", err);
            })
            .finally(() => {
                loading = false;
            });
    }

    /* we need to call this on mount but also when the chat changes.
       you would think we could do that in a $: block, but that seems to cause it
       to run twice on initial mount (grrrr)
    */
    onMount(() => init(container));

    function toggleLink() {
        if (container.kind === "channel") return;
        if (loading) return;
        loading = true;
        if (checked) {
            client
                .enableInviteCode(container.id)
                .then((resp) => {
                    if (resp.kind === "success") {
                        code = resp.code;
                    } else {
                        error = unauthorized;
                        checked = false;
                        client.logMessage("Unauthorized response calling enableInviteCode");
                    }
                })
                .catch((err) => {
                    checked = false;
                    error = i18nKey("invite.errorEnablingLink");
                    client.logError("Unable to enable invite code: ", err);
                })
                .finally(() => {
                    loading = false;
                });
        } else {
            client
                .disableInviteCode(container.id)
                .catch((err) => {
                    code = undefined;
                    checked = true;
                    error = i18nKey("invite.errorDisablingLink");
                    client.logError("Unable to disable invite code: ", err);
                })
                .finally(() => {
                    loading = false;
                });
        }
    }

    function resetLink(): Promise<void> {
        if (container.kind === "channel") return Promise.resolve();
        return client
            .resetInviteCode(container.id)
            .then((resp) => {
                if (resp.kind === "success") {
                    code = resp.code;
                } else {
                    error = unauthorized;
                    client.logMessage("Unauthorized response calling resetInviteCode");
                }
            })
            .catch((err) => {
                error = i18nKey("invite.errorResettingLink");
                client.logError("Unable to reset invite code: ", err);
            });
    }

    function onConfirmReset(yes: boolean): Promise<void> {
        const result = yes ? resetLink() : Promise.resolve();

        return result.finally(() => {
            confirmReset = false;
        });
    }

    function onCopy() {
        navigator.clipboard.writeText(link).then(
            () => {
                toastStore.showSuccessToast(i18nKey("linkCopiedToClipboard"));
            },
            () => {
                toastStore.showFailureToast(i18nKey("failedToCopyLinkToClipboard"));
            },
        );
    }

    function onShare() {
        shareLink(link);
    }
</script>

{#if !container.public}
    <div class="toggle-row">
        <Toggle
            id="enable-invite-link"
            small
            on:change={toggleLink}
            disabled={loading}
            waiting={loading}
            label={i18nKey("invite.enableLink")}
            bind:checked />

        <div class:spinner />
    </div>
{/if}
{#if ready}
    {#if container.public || (code !== undefined && checked)}
        <div class="link-enabled">
            <div class="link">{link}</div>
            <QRCode text={link} border fullWidthOnMobile />
            <div class="message">
                <Markdown
                    text={interpolate(
                        $_,
                        i18nKey("invite.shareMessage", undefined, container.level, true),
                    ) + (container.public ? "" : $_("invite.shareMessageTrust"))} />
            </div>
            <div class="action">
                <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
                <Link on:click={onCopy}>
                    <Translatable resourceKey={i18nKey("copy")} />
                </Link>
            </div>
            {#if canShare()}
                <div class="action">
                    <ShareIcon size={$iconSize} color={"var(--icon-txt)"} />
                    <Link on:click={onShare}>
                        <Translatable resourceKey={i18nKey("share")} />
                    </Link>
                </div>
            {/if}
            {#if !container.public}
                <div class="action">
                    <RefreshIcon size={$iconSize} color={"var(--icon-txt)"} />
                    <Link
                        on:click={() => {
                            confirmReset = true;
                        }}>
                        <Translatable resourceKey={i18nKey("invite.resetLink")} />
                    </Link>
                </div>
            {/if}
        </div>
    {/if}
{/if}

{#if confirmReset}
    <AreYouSure
        message={i18nKey("invite.confirmReset", undefined, container.level, true)}
        action={onConfirmReset} />
{/if}

{#if error !== undefined}
    <ErrorMessage>{error}</ErrorMessage>
{/if}

<style lang="scss">
    .toggle-row {
        display: flex;
        justify-content: space-between;

        .spinner {
            top: -12px;
            left: -16px;
            @include loading-spinner(1.5em, 0.5em, var(--button-spinner));
        }
    }

    .link,
    .message {
        @include font(book, normal, fs-80);
    }

    .message {
        color: var(--txt-light);
    }

    .link {
        color: var(--link-underline);
    }

    .link-enabled {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    .action {
        display: flex;
        gap: $sp4;
        align-items: center;
    }
</style>
