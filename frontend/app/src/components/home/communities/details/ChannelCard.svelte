<script lang="ts">
    import Avatar from "../../../Avatar.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import {
        AvatarSize,
        type ChannelMatch,
        type OpenChat,
        routeForChatIdentifier,
        chatListScopeStore as chatListScope,
        selectedCommunity,
    } from "openchat-client";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { getContext } from "svelte";
    import page from "page";
    import AccessGateIcon from "../../access/AccessGateIcon.svelte";
    import { popRightPanelHistory } from "../../../../stores/rightPanel";
    import Markdown from "../../Markdown.svelte";

    export let channel: ChannelMatch;

    const client = getContext<OpenChat>("client");

    function selectChannel(match: ChannelMatch) {
        if ($selectedCommunity === undefined) return;
        if ($mobileWidth) {
            popRightPanelHistory();
        }
        page(routeForChatIdentifier($chatListScope.kind, match.id));
    }
</script>

<div class="details" on:click={() => selectChannel(channel)}>
    <div class="avatar">
        <Avatar
            url={client.groupAvatarUrl({ id: channel.id, ...channel.avatar }, $selectedCommunity)}
            size={AvatarSize.Default} />
    </div>
    <div class="channel-text">
        <h3 class="channel-name">
            {channel.name}
        </h3>
        {#if channel.description !== ""}
            <div class="desc">
                <Markdown text={channel.description} oneLine suppressLinks />
            </div>
        {/if}
        <div class="meta">
            <div class="attributes">
                <div class="members">
                    <span class="label"
                        ><AccountMultiple viewBox="0 -4 24 24" size={"1.2em"} /></span>
                    <span class="number">{channel.memberCount.toLocaleString()}</span>
                </div>
                <div class="gate">
                    <AccessGateIcon
                        button
                        clickable
                        level={"channel"}
                        small
                        position={"bottom"}
                        align={"middle"}
                        gateConfig={channel.gateConfig} />
                </div>
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
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        cursor: pointer;

        @include mobile() {
            padding: 0 toRem(10);
        }

        @media (hover: hover) {
            &:hover {
                background-color: var(--chatSummary-hv);
            }
        }

        .desc {
            @include font(light, normal, fs-80);
            color: var(--txt-light);
        }

        .meta {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: $sp3;

            .attributes {
                display: flex;
                align-items: center;
                gap: $sp3;
            }

            .members {
                background-color: var(--input-bg);
                padding: $sp1 $sp3;
                border-radius: var(--rd);
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

        .channel-name,
        .desc {
            margin-bottom: $sp2;
        }
    }
</style>
