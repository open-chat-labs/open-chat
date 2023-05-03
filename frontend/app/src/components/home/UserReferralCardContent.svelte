<script lang="ts">
    import { getContext } from "svelte";
    import Markdown from "./Markdown.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import QR from "svelte-qr";
    import type { OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");
    const user = client.user;

    let link = `${window.location.origin}/?ref=${user.userId}`;

    function onCopy() {
        navigator.clipboard.writeText(link).then(
            () => toastStore.showSuccessToast("linkCopiedToClipboard"),
            () => toastStore.showFailureToast("failedToCopyLinkToClipboard")
        );
    }
</script>

<div class="container">
    <div class="link">
        <Markdown text={`[Your personal referral link](${link})`} />
        <div class="copy" on:click={onCopy}>
            <CopyIcon size={"1em"} color={"var(--icon-txt)"} />
        </div>
    </div>
    <div class="qr">
        <QR text={link} />
    </div>
    <div class="message">
        {$_("userReferralMessage")}
    </div>
</div>

<style type="text/scss">
    .qr {
        background-color: #fff;
        width: 250px;

        @include mobile() {
            width: 100%;
            margin: 0;
        }
    }

    .link,
    .message {
        @include font(book, normal, fs-80);
    }

    .link {
        display: flex;
        gap: $sp2;
        align-items: center;
    }

    .copy {
        cursor: pointer;
    }

    .message {
        max-width: 250px;
    }

    .link {
        color: var(--link-underline);
    }

    .container {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
</style>
