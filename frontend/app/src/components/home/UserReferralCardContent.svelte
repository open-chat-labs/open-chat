<script lang="ts">
    import { currentUserIdStore } from "openchat-client";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import QRCode from "../QRCode.svelte";
    import Translatable from "../Translatable.svelte";

    let link = `${window.location.origin}/?ref=${$currentUserIdStore}`;

    function onCopy() {
        navigator.clipboard.writeText(link).then(
            () => toastStore.showSuccessToast(i18nKey("linkCopiedToClipboard")),
            () => toastStore.showFailureToast(i18nKey("failedToCopyLinkToClipboard")),
        );
    }
</script>

<div class="container">
    <div on:click={onCopy} class="link">
        <div><Translatable resourceKey={i18nKey("tapForReferralLink")} /></div>
        <CopyIcon size={"1em"} color={"var(--icon-txt)"} />
    </div>
    <QRCode text={link} size="larger" fullWidthOnMobile />
</div>

<style lang="scss">
    .link {
        display: flex;
        gap: $sp2;
        align-items: center;
        cursor: pointer;
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
