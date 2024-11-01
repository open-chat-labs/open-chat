<!-- svelte-ignore a11y-interactive-supports-focus -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import ThumbUp from "svelte-material-icons/ThumbUp.svelte";
    import ThumbDown from "svelte-material-icons/ThumbDown.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { activeVideoCall, type RequestToSpeak } from "../../../stores/video";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { fly } from "svelte/transition";
    import { cubicInOut } from "svelte/easing";
    import Avatar from "../../Avatar.svelte";
    import { getContext } from "svelte";
    import { AvatarSize, type OpenChat, userStore } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: requests = $activeVideoCall?.accessRequests ?? [];

    function approve(request: RequestToSpeak) {
        activeVideoCall.approveAccessRequest(request);
    }

    function reject(request: RequestToSpeak) {
        activeVideoCall.rejectAccessRequest(request);
    }
</script>

{#each requests as request, i}
    <div
        style={`top: ${50 + i * 8}px; right: ${50 + i * 8}px;`}
        in:fly={{
            duration: 300,
            y: -500,
            opacity: 0,
            easing: cubicInOut,
        }}
        out:fly={{
            duration: 300,
            x: 500,
            opacity: 0,
            easing: cubicInOut,
        }}
        class="message">
        <div class="avatar">
            <Avatar
                url={client.userAvatarUrl($userStore.get(request.userId))}
                userId={request.userId}
                size={AvatarSize.Small} />
        </div>
        <Translatable
            resourceKey={i18nKey("videoCall.accessRequest", {
                username: $userStore.get(request.userId)?.username,
            })} />
        <div role="button" on:click={() => approve(request)} class="btn">
            <ThumbUp size={$iconSize} color={"var(--vote-yes-color)"} />
        </div>
        <div role="button" on:click={() => reject(request)} class="btn">
            <ThumbDown size={$iconSize} color={"var(--vote-no-color)"} />
        </div>
    </div>
{/each}

<style lang="scss">
    .message {
        position: absolute;
        @include z-index("toast");
        padding: $sp4;
        // width: 75%;
        max-width: 800px;
        margin: 0 $sp4;
        display: flex;
        gap: $sp4;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--bd);
        @include mobile() {
            width: 100%;
        }
        background-color: var(--modal-bg);
        box-shadow: var(--modal-sh);
        color: var(--txt);

        .btn {
            cursor: pointer;
        }
    }

    .fake {
        position: absolute;
        bottom: 20px;
        left: 20px;
        padding: 10px;
        z-index: 1000;
    }
</style>
