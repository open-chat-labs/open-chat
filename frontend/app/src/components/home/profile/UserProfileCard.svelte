<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import {
        AvatarSize,
        type OpenChat,
        PremiumItem,
        type PublicProfile,
        type UserSummary,
        currentUserIdStore,
        mobileWidth,
        selectedChatMembersStore,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
    } from "openchat-client";

    import EditableAvatar from "@src/components/EditableAvatar.svelte";
    import EditableImageWrapper from "@src/components/EditableImageWrapper.svelte";
    import HoverIcon from "@src/components/HoverIcon.svelte";
    import ChooseImage from "@src/components/icons/ChooseImage.svelte";
    import PremiumItemComponent from "@src/components/PremiumItem.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import ClockOutline from "svelte-material-icons/ClockOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Avatar from "../../Avatar.svelte";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import Badges from "./Badges.svelte";
    import ChitBalance from "./ChitBalance.svelte";
    import CustomBackgroundOverlay from "./CustomBackgroundOverlay.svelte";
    import RoleIcon from "./RoleIcon.svelte";
    import WithRole from "./WithRole.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        inGlobalContext?: boolean;
        onClose?: () => void;
        userProfileMode?: boolean;
        profile: PublicProfile;
        user: UserSummary;
    }

    let {
        inGlobalContext = false,
        onClose,
        userProfileMode = false,
        profile = $bindable(),
        user,
    }: Props = $props();

    let lastOnline: number | undefined = $state();

    onMount(async () => {
        try {
            lastOnline = await client.getLastOnlineDate(user.userId, Date.now());
        } catch (e: any) {
            client.logError("Failed to load user profile", e);
            onClose?.();
        }
    });

    function formatDate(timestamp: bigint): string {
        const date = new Date(Number(timestamp));
        return date.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
        });
    }

    let diamondStatus = $derived(user?.diamondStatus);
    let me = $derived(user.userId === $currentUserIdStore);
    let isSuspended = $derived(user?.suspended ?? false);
    let modal = $derived($mobileWidth);
    let [status, online] = $derived(
        lastOnline !== undefined && lastOnline !== 0
            ? client.formatLastOnlineDate($_, Date.now(), lastOnline)
            : ["", false],
    );
    let avatarUrl = $derived(
        profile !== undefined
            ? client.buildUserAvatarUrl(
                  import.meta.env.OC_BLOB_URL_PATTERN!,
                  user.userId,
                  profile.avatarId,
              )
            : "/assets/unknownUserAvatar.svg",
    );
    let backgroundUrl = $derived(
        profile !== undefined
            ? client.buildUserBackgroundUrl(
                  import.meta.env.OC_BLOB_URL_PATTERN!,
                  user.userId,
                  profile.backgroundId,
              )
            : undefined,
    );
    let hasCustomBackground = $derived(backgroundUrl !== undefined);
    let txtColour = $derived(hasCustomBackground ? "#fff" : "var(--txt)");
    let joined = $derived(
        profile !== undefined ? `${$_("joined")} ${formatDate(profile.created)}` : undefined,
    );
    let displayName = $derived(
        client.getDisplayName(
            user.userId,
            inGlobalContext ? undefined : $selectedCommunityMembersStore,
            inGlobalContext ? undefined : $selectedChatWebhooksStore,
        ),
    );

    function userAvatarSelected(detail: { url: string; data: Uint8Array }): void {
        client.setUserAvatar(detail.data, detail.url).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("avatarUpdateFailed"));
            }
        });
    }

    function onBackgroundImageSelected(args: { url: string; data: Uint8Array }) {
        client.setUserProfileBackground(args.data).then((blobId) => {
            if (blobId !== undefined) {
                profile = {
                    ...profile,
                    backgroundId: blobId,
                };
            } else {
                toastStore.showFailureToast(i18nKey("avatarUpdateFailed"));
            }
        });
    }
</script>

{#if profile !== undefined}
    <EditableImageWrapper
        image={backgroundUrl}
        mode={"profile"}
        onImageSelected={onBackgroundImageSelected}>
        {#snippet children(choosePhoto: () => void)}
            <div
                class="profile_card"
                class:userProfileMode
                class:hasCustomBackground
                style={userProfileMode && backgroundUrl
                    ? `background-image: url(${backgroundUrl})`
                    : ""}>
                <div class="header" class:hasCustomBackground>
                    <div class="handle">
                        <div class="display_name">
                            {displayName}
                        </div>
                        <div class="name_and_badges">
                            <div class="username">
                                @{profile!.username}
                            </div>
                            <Badges
                                uniquePerson={user?.isUniquePerson}
                                {diamondStatus}
                                streak={user?.streak}
                                chitEarned={user?.totalChitEarned} />
                            {#if user !== undefined && $selectedChatSummaryStore !== undefined && $selectedChatSummaryStore.kind !== "direct_chat"}
                                <WithRole
                                    userId={user.userId}
                                    chatMembers={$selectedChatMembersStore}
                                    communityMembers={$selectedCommunityMembersStore}>
                                    {#snippet children(communityRole, chatRole)}
                                        <RoleIcon level="community" popup role={communityRole} />
                                        <RoleIcon
                                            level={$selectedChatSummaryStore?.kind === "channel"
                                                ? "channel"
                                                : "group"}
                                            popup
                                            role={chatRole} />
                                    {/snippet}
                                </WithRole>
                            {/if}
                        </div>
                    </div>
                    {#if userProfileMode}
                        <PremiumItemComponent
                            item={PremiumItem.CustomProfileBackground}
                            onClick={choosePhoto}>
                            {#snippet children(click)}
                                <HoverIcon onclick={click}>
                                    <ChooseImage size={"1.5em"} color={txtColour} />
                                </HoverIcon>
                            {/snippet}
                        </PremiumItemComponent>
                    {:else}
                        <HoverIcon onclick={onClose}>
                            <Close size={"1em"} color={txtColour} />
                        </HoverIcon>
                    {/if}
                </div>
                <div class="body" class:modal>
                    <div class="avatar">
                        {#if userProfileMode}
                            <EditableAvatar
                                overlayIcon
                                size={"medium"}
                                image={client.userAvatarUrl(user)}
                                onImageSelected={userAvatarSelected} />
                        {:else}
                            <Avatar url={avatarUrl} userId={user.userId} size={AvatarSize.Large} />
                        {/if}
                    </div>
                    {#if user !== undefined && !$disableChit}
                        <ChitBalance size={"small"} {me} chitBalance={user.chitBalance} />
                    {/if}
                    <CustomBackgroundOverlay {userProfileMode} {hasCustomBackground}>
                        {#if profile!.bio.length > 0}
                            <p class="bio"><Markdown inline={false} text={profile!.bio} /></p>
                        {/if}
                        <div class="meta">
                            <div class="left" class:suspended={isSuspended}>
                                {#if isSuspended}
                                    <Translatable resourceKey={i18nKey("accountSuspended")} />
                                {:else}
                                    {#if online}
                                        <div class="online"></div>
                                    {/if}
                                    {status === "" ? "..." : status}
                                {/if}
                            </div>
                            <div class="right">
                                <ClockOutline size={"12px"} color={txtColour} />
                                {joined}
                            </div>
                        </div>
                    </CustomBackgroundOverlay>
                </div>
            </div>
        {/snippet}
    </EditableImageWrapper>
{/if}

<style lang="scss">
    .profile_card:not(.userProfileMode) {
        width: 350px;
        @include mobile() {
            width: 100%;
        }
    }

    .profile_card {
        &.userProfileMode {
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            border-radius: var(--modal-rd);

            &:not(.hasCustomBackground) {
                border: var(--bw) solid var(--bd);
                @include box-shadow(1);
            }

            .body {
                border-radius: 0 0 var(--modal-rd) var(--modal-rd);
            }
        }
    }

    .body {
        position: relative;
        display: flex;
        flex-direction: column;
        @include font-size(fs-90);
        word-wrap: break-word;

        .avatar {
            padding: 0 0 $sp4 0;
            -webkit-box-reflect: below -24px linear-gradient(hsla(0, 0%, 100%, 0), hsla(
                            0,
                            0%,
                            100%,
                            0
                        )
                        45%, hsla(0, 0%, 100%, 0.2));
        }

        .bio {
            max-height: 180px;
            overflow-y: auto;
            @include font(book, normal, fs-80, 20);
            @include nice-scrollbar();
            color: var(--txt-light);
            margin-bottom: $sp3;
            width: 100%;
        }

        &.modal {
            width: 100%;
        }

        .meta {
            @include font(light, normal, fs-60);
            padding: 12px 0;
            margin-top: $sp2;
            border-top: 1px solid var(--bd);
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: $sp3;

            .left,
            .right {
                display: flex;
                align-items: center;
                gap: $sp2;
            }

            .left {
                justify-self: flex-start;
            }

            .right {
                justify-self: flex-end;
            }

            @include mobile() {
                .left,
                .right {
                    @include font(light, normal, fs-90);
                }
            }

            .suspended {
                color: var(--menu-warn);
            }

            .online {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background-color: green;
            }
        }
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: $sp4 $sp5;
        border-radius: var(--modal-rd) var(--modal-rd) 0 0;

        &.hasCustomBackground {
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0));

            * {
                color: #fff !important;
                text-shadow: 1px 1px 0 #000 !important;
            }
        }

        @include mobile() {
            padding: $sp3 $sp4;
        }
        @include font(bold, normal, fs-100, 21);

        .handle {
            overflow-wrap: anywhere;

            .username {
                font-weight: 200;
                color: var(--txt-light);
            }
        }

        .name_and_badges {
            display: inline-flex;
            gap: $sp2;
            align-items: center;
        }
    }
</style>
