<script lang="ts">
    import { allUsersStore, AvatarSize, iconSize, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import ThumbDown from "svelte-material-icons/ThumbDown.svelte";
    import ThumbUp from "svelte-material-icons/ThumbUp.svelte";
    import { cubicInOut } from "svelte/easing";
    import { fly } from "svelte/transition";
    import { i18nKey } from "../../../i18n/i18n";
    import { activeVideoCall, type RequestToSpeak } from "../../../stores/video";
    import Avatar from "../../Avatar.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    let requests = $derived($activeVideoCall?.accessRequests ?? []);

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
                url={client.userAvatarUrl($allUsersStore.get(request.userId))}
                userId={request.userId}
                size={AvatarSize.Small} />
        </div>
        <Translatable
            resourceKey={i18nKey("videoCall.accessRequest", {
                username: $allUsersStore.get(request.userId)?.username,
            })} />
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div role="button" onclick={() => approve(request)} class="btn">
            <ThumbUp size={$iconSize} color={"var(--vote-yes-color)"} />
        </div>
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div role="button" onclick={() => reject(request)} class="btn">
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
</style>
