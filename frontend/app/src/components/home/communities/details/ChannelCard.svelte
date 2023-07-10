<script lang="ts">
    import Avatar from "../../../Avatar.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
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

<div class="details" on:click={() => selectChannel(channel)}>
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
        <div class="meta">
            <div class="members">
                <span class="label"><AccountMultiple viewBox="0 -4 24 24" size={"1.2em"} /></span>
                <span class="number">{channel.memberCount.toLocaleString()}</span>
            </div>
            <div class="gate">
                <AccessGateIcon
                    small
                    position={"right"}
                    align={"center"}
                    on:upgrade
                    gate={channel.gate} />
            </div>
        </div>
    </div>
</div>

<style lang="scss">
    .details {
        display: flex;
        align-items: center;
        gap: $sp4;
        padding: $sp4;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        cursor: pointer;

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        .is-default {
            margin-left: $sp3;
            @include font(light, normal, fs-70);
            color: var(--txt-light);
        }

        .meta {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: 6px;

            .members {
                background-color: var(--input-bg);
                padding: $sp1 $sp3;
                border-radius: $sp2;
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
            margin-bottom: $sp2;
        }
    }
</style>
