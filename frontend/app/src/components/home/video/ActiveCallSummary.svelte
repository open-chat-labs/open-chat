<script lang="ts">
    import { routeForChatIdentifier, type ChatIdentifier, OpenChat } from "openchat-client";
    import { activeVideoCall } from "../../../stores/video";
    import page from "page";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    $: chatSummariesStore = client.chatSummariesStore;
    $: communities = client.communities;

    function goToCall() {
        if ($activeVideoCall) {
            page(routeForChatIdentifier("none", $activeVideoCall.chatId));
        }
    }

    $: name = getChatName($activeVideoCall?.chatId);

    function getChatName(chatId: ChatIdentifier | undefined) {
        if (chatId) {
            const chat = $chatSummariesStore.get(chatId);
            if (chat) {
                switch (chat.kind) {
                    case "direct_chat":
                        return "TODO - get the user's name";
                    case "group_chat":
                        return chat.name;
                    case "channel":
                        return `${
                            $communities.get({
                                kind: "community",
                                communityId: chat.id.communityId,
                            })?.name
                        } > ${chat.name}`;
                }
            }
        }
    }
</script>

{#if $activeVideoCall !== undefined}
    <div role="button" tabindex="0" on:click={goToCall} class="call">
        <p>You are in a video call at the moment</p>
        <span>{name}</span>
    </div>
{/if}

<style lang="scss">
    .call {
        cursor: pointer;
        position: sticky;
        bottom: 0;
        width: 100%;
        padding: $sp5;
        background-color: var(--toast-success-bg);
        color: var(--toast-success-txt);
    }
</style>
