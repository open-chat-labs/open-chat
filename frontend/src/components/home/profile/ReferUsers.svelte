<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import type { CreatedUser, PartialUserSummary } from "../../../domain/user/user";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { _ } from "svelte-i18n";
    import { currentUserKey } from "../../../fsm/home.controller";
    import Link from "../../Link.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import * as shareFunctions from "../../../domain/share";
    import { toastStore } from "../../../stores/toast";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";
    import { AvatarSize, UserStatus } from "../../../domain/user/user";
    import Avatar from "../../Avatar.svelte";
    import { userAvatarUrl } from "../../../domain/user/user.utils";
    import { userStore } from "../../../stores/user";
    import LinkButton from "../../LinkButton.svelte";

    const dispatch = createEventDispatcher();

    const user = getContext<CreatedUser>(currentUserKey);

    let link = `${window.location.origin}/?ref=${user.userId}`;
    let viewedUserId: string | undefined = undefined;

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

    function showUserProfile(userId: string) {
        viewedUserId = userId;
    }

    function closeUserProfile() {
        viewedUserId = undefined;
    }

    function onChat() {
        if (viewedUserId !== undefined) {
            closeUserProfile();
            dispatch("chatWith", viewedUserId);
        }
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
    {#if user.referrals.length > 0}
        <div class="referrals-section">
            <h4>{$_("invitedUsers")}</h4>
            <div class="referrals">
                {#each user.referrals as userId}
                    <div class="referral" on:click={() => showUserProfile(userId)}>
                        <div>
                            <Avatar
                                url={userAvatarUrl($userStore[userId])}
                                status={UserStatus.None}
                                size={AvatarSize.Weeny} />
                        </div>
                        <LinkButton underline="hover">
                            {$userStore[userId]?.username ?? $_("unknownUser")}
                        </LinkButton>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

{#if viewedUserId !== undefined}
    <ViewUserProfile
        userId={viewedUserId}
        on:openDirectChat={onChat}
        on:close={closeUserProfile}
        on:showFaqQuestion />
{/if}

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
