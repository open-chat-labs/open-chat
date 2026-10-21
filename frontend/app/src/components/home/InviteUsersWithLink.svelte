<script lang="ts">
    import {
        type CommunitySummary,
        currentUserIdStore,
        iconSize,
        type InviteLink,
        type InviteLinkOutcome,
        inviteLinkUrl,
        type MultiUserChat,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import RefreshIcon from "svelte-material-icons/Refresh.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import { canShare, shareLink } from "../../utils/share";
    import AreYouSure from "../AreYouSure.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Link from "../Link.svelte";
    import QRCode from "../QRCode.svelte";
    import Toggle from "../Toggle.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import Markdown from "@src/core/Markdown.svelte";

    interface Props {
        container: MultiUserChat | CommunitySummary;
    }

    let { container }: Props = $props();

    const client = getContext<OpenChat>("client");

    // undefined until the link has loaded
    let link = $state<InviteLink>();
    let error = $state<ResourceKey>();
    let checked = $state(false);
    let loading = $state(false);
    let confirmReset = $state(false);

    function apply(outcome: InviteLinkOutcome) {
        if (outcome.kind === "failed") {
            error = outcome.message;
        } else {
            link = outcome;
            error = undefined;
        }
        checked = link?.kind === "enabled";
    }

    onMount(async () => {
        loading = true;
        try {
            apply(await client.getInviteLink(container));
        } finally {
            loading = false;
        }
    });

    async function toggleLink() {
        if (loading) return;
        loading = true;
        try {
            apply(await client.setInviteLinkEnabled(container, checked));
        } finally {
            loading = false;
        }
    }

    async function onConfirmReset(yes: boolean): Promise<void> {
        try {
            if (yes) {
                apply(await client.resetInviteLink(container));
            }
        } finally {
            confirmReset = false;
        }
    }

    function onCopy() {
        if (url === undefined) return;
        navigator.clipboard.writeText(url).then(
            () => {
                toastStore.showSuccessToast(i18nKey("linkCopiedToClipboard"));
            },
            () => {
                toastStore.showFailureToast(i18nKey("failedToCopyLinkToClipboard"));
            },
        );
    }

    function onShare() {
        if (url !== undefined) shareLink(url);
    }

    let url = $derived(
        inviteLinkUrl(client.canonicalOrigin(), container.id, $currentUserIdStore, link),
    );
    let hasCode = $derived(link?.kind === "enabled" || link?.kind === "disabled");
    let spinner = $derived(loading && link?.kind !== "enabled");
</script>

{#if hasCode}
    <div class="toggle-row">
        <Toggle
            id="enable-invite-link"
            small
            onChange={toggleLink}
            disabled={loading}
            waiting={loading}
            label={i18nKey("invite.enableLink")}
            bind:checked />

        <div class:spinner></div>
    </div>
{/if}
{#if url !== undefined}
    <div class="link-enabled">
        <div class="link">{url}</div>
        <QRCode text={url} border fullWidthOnMobile />
        <div class="message">
            <Markdown
                text={interpolate(
                    $_,
                    i18nKey("invite.shareMessage", undefined, container.level, true),
                ) + (container.public ? "" : $_("invite.shareMessageTrust"))} />
        </div>
        <div class="action">
            <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
            <Link onClick={onCopy}>
                <Translatable resourceKey={i18nKey("copy")} />
            </Link>
        </div>
        {#if canShare()}
            <div class="action">
                <ShareIcon size={$iconSize} color={"var(--icon-txt)"} />
                <Link onClick={onShare}>
                    <Translatable resourceKey={i18nKey("share")} />
                </Link>
            </div>
        {/if}
        {#if link?.kind === "enabled"}
            <div class="action">
                <RefreshIcon size={$iconSize} color={"var(--icon-txt)"} />
                <Link
                    onClick={() => {
                        confirmReset = true;
                    }}>
                    <Translatable resourceKey={i18nKey("invite.resetLink")} />
                </Link>
            </div>
        {/if}
    </div>
{/if}

{#if confirmReset}
    <AreYouSure
        message={i18nKey("invite.confirmReset", undefined, container.level, true)}
        action={onConfirmReset} />
{/if}

{#if error !== undefined}
    <ErrorMessage><Translatable resourceKey={error} /></ErrorMessage>
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
