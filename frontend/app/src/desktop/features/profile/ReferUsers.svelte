<script lang="ts">
    import { currentUserIdStore, iconSize } from "@client";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { canShare, shareLink } from "@src/utils/share";
    import Link from "@src/desktop/shared/Link.svelte";
    import QRCode from "@src/desktop/shared/QRCode.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    let link = $derived(`${window.location.origin}/?ref=${$currentUserIdStore}`);

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
