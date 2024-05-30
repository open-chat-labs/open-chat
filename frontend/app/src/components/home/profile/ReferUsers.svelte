<script lang="ts">
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import QRCode from "../../QRCode.svelte";
    import Link from "../../Link.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { toastStore } from "../../../stores/toast";
    import { AvatarSize } from "openchat-client";
    import Avatar from "../../Avatar.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import { canShare, shareLink } from "../../../utils/share";
    import type { ProfileLinkClickedEvent } from "../../web-components/profileLink";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Badges from "./Badges.svelte";

    const client = getContext<OpenChat>("client");

    $: user = client.user;
    $: userStore = client.userStore;
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

    function showUserProfile(ev: Event, userId: string) {
        ev.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: { userId, chatButton: false, inGlobalContext: true },
                bubbles: true,
            }),
        );
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
    {#if $user.referrals.length > 0}
        <div class="referrals-section">
            <h4><Translatable resourceKey={i18nKey("invitedUsers")} /></h4>
            <div class="referrals">
                {#each $user.referrals as userId}
                    {@const u = $userStore[userId]}
                    <div class="referral" on:click={(ev) => showUserProfile(ev, userId)}>
                        <div>
                            <Avatar
                                url={client.userAvatarUrl(u)}
                                {userId}
                                size={AvatarSize.Default} />
                        </div>
                        <LinkButton underline="hover">
                            {client.displayName(u)}
                            <Badges diamondStatus={u?.diamondStatus} streak={u?.streak ?? 0} />
                        </LinkButton>
                    </div>
                {/each}
            </div>
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

    .referrals-section {
        margin-top: $sp3;

        .referrals {
            display: flex;
            flex-direction: column;
            gap: $sp3;
            margin-top: $sp4;
            width: fit-content;

            .referral {
                cursor: pointer;
                align-items: center;
                display: flex;
                gap: $sp3;
            }
        }
    }
</style>
