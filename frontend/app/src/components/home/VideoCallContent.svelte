<script lang="ts">
    import { _ } from "svelte-i18n";
    import { AvatarSize, OpenChat, type VideoCallContent } from "openchat-client";
    import Avatar from "../Avatar.svelte";
    import { getContext } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";

    const client = getContext<OpenChat>("client");

    $: communityMembers = client.currentCommunityMembers;
    $: userStore = client.userStore;
    $: initiator = content.participants[0];
    $: displayName = initiator
        ? client.getDisplayNameById(initiator.userId, $communityMembers)
        : $_("unknownUser");
    $: incall = true;

    export let content: VideoCallContent;
</script>

<div class="video-call">
    <p class="initiator">
        <Translatable resourceKey={i18nKey("videoCall.startedBy", { username: displayName })} />
    </p>
    <div class="avatars">
        {#each [...content.participants].slice(0, 5) as participantId}
            <Avatar
                url={client.userAvatarUrl($userStore[participantId.userId])}
                userId={participantId.userId}
                size={AvatarSize.Small} />
        {/each}
        {#if content.participants.length > 5}
            <div class="extra">
                {`+${content.participants.length - 5}`}
            </div>
        {/if}
    </div>
    {#if incall}
        <Button fill disabled={content.ended !== undefined}>
            <Translatable
                resourceKey={i18nKey(content.ended ? "videoCall.ended" : "videoCall.leave")} />
        </Button>
    {:else}
        <Button fill disabled={content.ended !== undefined}>
            <Translatable
                resourceKey={i18nKey(content.ended ? "videoCall.ended" : "videoCall.join")} />
        </Button>
    {/if}
</div>

<style lang="scss">
    .video-call {
        padding: $sp3 0 0 0;
    }

    .initiator {
        margin-bottom: $sp3;
    }

    .avatars {
        display: inline-flex;
        gap: $sp2;
        margin-bottom: $sp3;
    }

    .extra {
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 50%;
        width: toRem(25);
        height: toRem(25);
        @include font-size(fs-60);
        background-color: rgba(0, 0, 0, 0.15);
    }
</style>
