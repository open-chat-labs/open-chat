<script lang="ts">
    import { getContext } from "svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import QR from "svelte-qr";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { _ } from "svelte-i18n";
    import Link from "../../Link.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { toastStore } from "../../../stores/toast";
    import type { OpenChat, GroupChatSummary } from "openchat-client";
    import { canShare, shareLink } from "../../../utils/share";

    export let group: GroupChatSummary;

    const client = getContext<OpenChat>("client");

    $: link = `${window.location.origin}/${group.chatId}/?ref=${client.user.userId}`;

    function onCopy() {
        navigator.clipboard.writeText(link).then(
            () => {
                toastStore.showSuccessToast("linkCopiedToClipboard");
            },
            () => {
                toastStore.showFailureToast("failedToCopyLinkToClipboard");
            }
        );
    }

    function onShare() {
        shareLink(link);
    }
</script>

<div class="link-enabled">
    <div class="link">{link}</div>
    <div class="qr-wrapper">
        <div class="qr">
            <QR text={link} />
        </div>
    </div>
    <div class="message">
        {$_("group.shareMessage")}
    </div>
    <div class="action">
        <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
        <Link on:click={onCopy}>
            {$_("copy")}
        </Link>
    </div>
    {#if canShare()}
        <div class="action">
            <ShareIcon size={$iconSize} color={"var(--icon-txt)"} />
            <Link on:click={onShare}>
                {$_("share")}
            </Link>
        </div>
    {/if}
</div>

<style type="text/scss">
    .qr-wrapper {
        border: 1px solid var(--bd);
        .qr {
            background-color: #fff;
            margin: $sp5 auto;
            width: 200px;

            @include mobile() {
                width: 100%;
                margin: 0;
            }
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
