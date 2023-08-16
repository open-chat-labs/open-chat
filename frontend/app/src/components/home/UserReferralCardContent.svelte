<script lang="ts">
    import { getContext } from "svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import QRCode from "../QRCode.svelte";
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
    <div on:click={onCopy} class="link">
        <div>{$_("tapForReferralLink")}</div>
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
