<script lang="ts">
    import Avatar from "../../../Avatar.svelte";
    import Markdown from "../../Markdown.svelte";
    import { AvatarSize, ChannelMatch, OpenChat, routeForChatIdentifier } from "openchat-client";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { getContext } from "svelte";
    import page from "page";

    export let channel: ChannelMatch;

    const client = getContext<OpenChat>("client");
    $: selectedCommunity = client.selectedCommunity;
    $: chatListScope = client.chatListScope;

    function selectChannel(match: ChannelMatch) {
        if ($selectedCommunity === undefined) return;
        page(routeForChatIdentifier($chatListScope.kind, match.id));
    }
</script>

<div class="channel" on:click={() => selectChannel(channel)}>
    <div class="details">
        <div class="avatar">
            <Avatar
                url={client.groupAvatarUrl(channel.avatar)}
                size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
        </div>
        <div>
            <h3 class="channel-name">
                {channel.name}
            </h3>
            <div class="channel-desc">
                <Markdown text={channel.description} />
            </div>
        </div>
    </div>
</div>

<style lang="scss">
    .channel {
        padding: $sp4;
        // background-color: var(--accent);
        // background-color: var(--recommended-bg);
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        cursor: pointer;
        margin-bottom: $sp4;

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        .details {
            display: flex;
            gap: $sp4;

            .channel-name {
                margin-bottom: $sp3;
            }

            .channel-desc {
                color: var(--txt-light);
            }
        }
    }
</style>
