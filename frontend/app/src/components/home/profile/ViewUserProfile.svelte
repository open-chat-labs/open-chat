<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import Markdown from "../Markdown.svelte";
    import { AvatarSize, PublicProfile } from "openchat-client";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import type { PartialUserSummary } from "openchat-client";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { logger } from "../../../utils/logging";
    import type { OpenChat } from "openchat-client";
    import { rightPanelHistory } from "../../../stores/rightPanel";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let userId: string;
    export let alignTo: DOMRect | undefined = undefined;
    export let chatButton = true;

    let profile: PublicProfile | undefined = undefined;
    let user: PartialUserSummary | undefined;
    let lastOnline: number | undefined;

    $: me = userId === client.user.userId;
    $: isSuspended = user?.suspended ?? false;
    $: modal = $mobileWidth;
    $: status =
        lastOnline !== undefined && lastOnline !== 0
            ? client.formatLastOnlineDate($_, Date.now(), lastOnline)
            : "";
    $: avatarUrl =
        profile !== undefined
            ? client.buildUserAvatarUrl(process.env.BLOB_URL_PATTERN!, userId, profile.avatarId)
            : "../assets/unknownUserAvatar.svg";
    $: joined =
        profile !== undefined ? `${$_("joined")} ${formatDate(profile.created)}` : undefined;
    $: isPremium = profile?.isPremium ?? false;
    $: diamond = user?.diamond ?? false;
    $: phoneIsVerified = profile?.phoneIsVerified ?? false;

    onMount(async () => {
        try {
            const task1 = client.getPublicProfile(userId);
            const task2 = client.getUser(userId);
            lastOnline = await client.getLastOnlineDate(userId, Date.now());
            user = await task2;
            profile = await task1;
        } catch (e: any) {
            logger.error("Failed to load user profile", e);
            onClose();
        }
    });

    function handleOpenDirectChat() {
        dispatch("openDirectChat");
    }

    function showUserProfile() {
        rightPanelHistory.set([{ kind: "user_profile" }]);
        onClose();
    }

    function onClose() {
        dispatch("close");
    }

    function onWindowResize() {
        if (!modal) {
            onClose();
        }
    }

    function formatDate(timestamp: bigint): string {
        const date = new Date(Number(timestamp));
        return date.toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
        });
    }
</script>

<svelte:window on:resize={onWindowResize} />

{#if profile !== undefined}
    <Overlay dismissible={true} on:close={onClose}>
        <ModalContent
            closeIcon
            fill
            square
            compactFooter
            hideFooter={!me && !chatButton}
            fixedWidth={false}
            large={modal}
            {alignTo}
            on:close>
            <div class="header" slot="header">
                {$_("profile.label")}
            </div>
            <div slot="body" class="body" class:modal>
                <div class="avatar">
                    <Avatar url={avatarUrl} {userId} size={AvatarSize.Large} />
                </div>
                <h2 class:diamond>{profile.username}</h2>
                {#if profile.bio.length > 0}
                    <p class="bio"><Markdown text={profile.bio} /></p>
                {/if}
                <div class="meta">
                    <div class="left" class:suspended={isSuspended}>
                        {#if isSuspended}
                            {$_("accountSuspended")}
                        {:else}
                            {status === "" ? "..." : status}
                        {/if}
                    </div>
                    <div class="right">
                        {joined}
                    </div>
                    {#if client.user.isPlatformModerator}
                        {#if isPremium}
                            <p class="left">PREMIUM</p>
                        {/if}
                        {#if phoneIsVerified}
                            <p class="right">VERIFIED</p>
                        {/if}
                    {/if}
                </div>
            </div>
            <div slot="footer" class="footer">
                <ButtonGroup align={"fill"}>
                    {#if chatButton && !me}
                        <Button on:click={handleOpenDirectChat} small={true}
                            >{$_("profile.chat")}</Button>
                    {/if}
                    {#if me}
                        <Button on:click={showUserProfile} small={true}
                            >{$_("profile.settings")}</Button>
                    {/if}
                </ButtonGroup>
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .body {
        position: relative;
        display: flex;
        flex-direction: column;
        @include font-size(fs-90);
        word-wrap: break-word;
        width: 320px;
        padding: $sp4 $sp5 0 $sp5;

        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }

        .avatar {
            padding: 0 0 $sp4 0;
        }

        h2 {
            @include font(bold, normal, fs-100, 21);
            margin-bottom: $sp3;

            &.diamond {
                @include diamond();
            }
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

            .left {
                justify-self: flex-start;
            }

            .right {
                justify-self: flex-end;
            }

            @include mobile() {
                .left,
                .right {
                    @include font(light, normal, fs-80);
                    justify-self: center;
                }
            }

            .suspended {
                color: var(--menu-warn);
            }
        }
    }

    .header {
        @include font(bold, normal, fs-120, 29);
    }
</style>
