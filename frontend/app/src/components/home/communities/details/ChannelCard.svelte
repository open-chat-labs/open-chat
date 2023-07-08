<script lang="ts">
    import Avatar from "../../../Avatar.svelte";
    import Markdown from "../../Markdown.svelte";
    import { AvatarSize, ChannelMatch, OpenChat, routeForChatIdentifier } from "openchat-client";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import page from "page";
    import AccessGateIcon from "../../AccessGateIcon.svelte";

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
        <div class="channel-text">
            <h3 class="channel-name">
                {channel.name}
                {#if channel.isDefault}
                    <span class="is-default">({$_("communities.default")})</span>
                {/if}
            </h3>
            <div class="channel-desc">
                <Markdown oneLine suppressLinks text={channel.description} />
            </div>
            <div class="meta">
                <div class="gate">
                    <AccessGateIcon
                        position={"top"}
                        align={"start"}
                        on:upgrade
                        gate={channel.gate} />
                </div>
                <div class="members">
                    <span class="number">{channel.memberCount.toLocaleString()}</span>
                    <span class="label">{$_("communities.memberCount")}</span>
                </div>
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

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        .details {
            display: flex;
            gap: $sp4;

            .is-default {
                margin-left: $sp3;
                @include font(light, normal, fs-70);
                color: var(--txt-light);
            }

            .meta {
                display: flex;
                justify-content: space-between;
                align-items: center;

                .members {
                    .number {
                        font-weight: 500;
                    }
                    .label {
                        color: var(--txt-light);
                    }
                }
            }

            .channel-text {
                overflow: hidden;
                width: 100%;
            }

            .channel-name {
                margin-bottom: $sp3;
            }

            .channel-desc {
                color: var(--txt-light);
                @include ellipsis();
            }
        }
    }
</style>
