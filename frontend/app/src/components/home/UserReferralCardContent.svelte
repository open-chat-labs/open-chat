<script lang="ts">
    import { getContext } from "svelte";
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
    <div on:click={onCopy} class="link">
        <div>{$_("tapForReferralLink")}</div>
        <CopyIcon size={"1em"} color={"var(--icon-txt)"} />
    </div>
    <div class="qr">
        <QR text={link} />
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
