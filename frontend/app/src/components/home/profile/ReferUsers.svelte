<script lang="ts">
    import { currentUser as user } from "openchat-client";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import QRCode from "../../QRCode.svelte";
    import Link from "../../Link.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { toastStore } from "../../../stores/toast";
    import { canShare, shareLink } from "../../../utils/share";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    $: link = `${window.location.origin}/?ref=${$user.userId}`;

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

<div class="container">
    <div class="link">{link}</div>
    <QRCode text={link} border fullWidthOnMobile />
    <div class="message">
        <Translatable resourceKey={i18nKey("userReferralMessage")} />
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
</div>

<style lang="scss">
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

    .container {
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
