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

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let userId: string;
    export let alignTo: DOMRect | undefined = undefined;
    export let chatButton = true;

    let profile: PublicProfile | undefined = undefined;
    let user: PartialUserSummary | undefined;

    $: modal = alignTo === undefined || $mobileWidth;
    $: status = client.formatLastOnlineDate($_, Date.now(), user);
    $: avatarUrl =
        profile !== undefined
            ? client.buildUserAvatarUrl(process.env.BLOB_URL_PATTERN!, userId, profile.avatarId)
            : "../assets/unknownUserAvatar.svg";
    $: joined = profile !== undefined ? `${$_("joined")} ${formatDate(profile.created)}` : undefined;
    $: isPremium = profile?.isPremium ?? false;
    $: phoneIsVerified = profile?.phoneIsVerified ?? false;

    onMount(async () => {
        try {
            const task1 = client.getUser(userId);
            profile = await client.getPublicProfile(userId);
            user = await task1;
        } catch (e: any) {
            logger.error("Failed to load user profile", e);
            onClose();
        }
    });

    function handleOpenDirectChat() {
        dispatch("openDirectChat");
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
            year: "numeric" 
        });
    }
</script>

<svelte:window on:resize={onWindowResize} />

{#if profile !== undefined}
    <Overlay dismissible={true} fade={modal} on:close={onClose}>
        <ModalContent
            hideHeader={true}
            compactFooter={true}
            fixedWidth={false}
            large={modal}
            {alignTo}
            on:close>
            <div slot="body" class="body" class:modal>
                <Avatar url={avatarUrl} size={AvatarSize.ExtraLarge} />
                <h2>{profile.username}</h2>
                <p>{status === "" ? "..." : status}</p>
                {#if client.user.isSuperAdmin}
                    <p>{joined}</p>
                    {#if isPremium}
                        <p>PREMIUM</p>
                    {/if}
                    {#if phoneIsVerified}
                        <p>VERIFIED</p>
                    {/if}
                {/if}
                {#if profile.bio.length > 0}
                    <p class="bio"><Markdown text={profile.bio} /></p>
                {/if}
            </div>
            <div slot="footer" class="footer">
                <ButtonGroup align={chatButton ? "fill" : "center"}>
                    {#if chatButton}
                        <Button on:click={handleOpenDirectChat} small={true}>Chat</Button>
                    {/if}
                    <Button on:click={onClose} small={true} secondary={true}>Close</Button>
                </ButtonGroup>
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style type="text/scss">
    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        @include font-size(fs-90);
        word-wrap: break-word;
        min-width: 200px;
        max-width: 280px;

        h2 {
            margin-top: $sp3;
        }

        .bio {
            max-height: 180px;
            overflow-y: auto;
            @include nice-scrollbar();
            margin-top: $sp4;
        }

        &.modal {
            max-width: 400px;

            .bio {
                max-height: none;
            }
        }
    }
</style>
