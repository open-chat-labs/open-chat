<script lang="ts">
    import { getContext } from "svelte";
    import type { CreatedUser } from "../../../domain/user/user";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { _ } from "svelte-i18n";
    import { currentUserKey } from "../../../fsm/home.controller";
    import Link from "../../Link.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import * as shareFunctions from "../../../domain/share";
    import { toastStore } from "../../../stores/toast";

    const user = getContext<CreatedUser>(currentUserKey);

    let link = `${window.location.origin}/?ref=${user.userId}`;

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
        shareFunctions.shareLink(link);
    }
</script>

<div class="container">
    <div class="link">{link}</div>
    <div class="message">
        {$_("userReferralMessage")}
    </div>
    <div class="action">
        <CopyIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
        <Link on:click={onCopy}>
            {$_("copy")}
        </Link>
    </div>
    {#if shareFunctions.canShare()}
        <div class="action">
            <ShareIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
            <Link on:click={onShare}>
                {$_("share")}
            </Link>
        </div>
    {/if}
</div>

<style type="text/scss">
    .link,
    .message {
        @include font(book, normal, fs-80);
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
