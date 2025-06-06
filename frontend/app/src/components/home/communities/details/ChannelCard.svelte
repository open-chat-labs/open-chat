<script lang="ts">
    import HoverIcon from "@src/components/HoverIcon.svelte";
    import Menu from "@src/components/Menu.svelte";
    import MenuIcon from "@src/components/MenuIcon.svelte";
    import MenuItem from "@src/components/MenuItem.svelte";
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import {
        AvatarSize,
        type ChannelMatch,
        chatListScopeStore,
        iconSize,
        mobileWidth,
        type OpenChat,
        routeForChatIdentifier,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Avatar from "../../../Avatar.svelte";
    import AccessGateIcon from "../../access/AccessGateIcon.svelte";
    import Markdown from "../../Markdown.svelte";

    interface Props {
        channel: ChannelMatch;
        onDeleteChannel: () => void;
    }

    let { channel, onDeleteChannel }: Props = $props();

    const client = getContext<OpenChat>("client");

    let canDeleteChannel = $derived(client.canDeleteChannel(channel.id));

    function selectChannel(match: ChannelMatch) {
        if ($selectedCommunitySummaryStore === undefined) return;
        if (!match.public) return;
        if ($mobileWidth) {
            client.popRightPanelHistory();
        }
        page(routeForChatIdentifier($chatListScopeStore.kind, match.id));
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class:clickable={channel.public} class="details" onclick={() => selectChannel(channel)}>
    <div class="avatar">
        <Avatar
            url={client.groupAvatarUrl(
                { id: channel.id, ...channel.avatar },
                $selectedCommunitySummaryStore,
            )}
            size={AvatarSize.Default} />
    </div>
    <div class="channel-text">
        <div class="channel-name">
            {#if !channel.public}
                <div class="private"></div>
            {/if}
            <h3>
                {channel.name}
            </h3>
        </div>
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
    {#if canDeleteChannel}
        <div class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                {#snippet menuIcon()}
                    <HoverIcon>
                        <DotsVertical size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        <MenuItem warning onclick={onDeleteChannel}>
                            {#snippet icon()}
                                <DeleteOutline size={$iconSize} color={"var(--menu-warn)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable
                                    resourceKey={i18nKey("deleteGroup", undefined, "channel")} />
                            {/snippet}
                        </MenuItem>
                    </Menu>
                {/snippet}
            </MenuIcon>
        </div>
    {/if}
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

        &.clickable {
            cursor: pointer;
            @media (hover: hover) {
                &:hover {
                    background-color: var(--chatSummary-hv);
                }
            }
        }

        @include mobile() {
            padding: 0 toRem(10);
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

        .channel-name {
            display: flex;
            align-items: center;
            gap: $sp2;
            @include ellipsis();
            h3 {
                @include font(bold, normal, fs-100);
            }
        }

        .channel-name,
        .desc {
            margin-bottom: $sp2;
        }
    }

    .private {
        background-repeat: no-repeat;
        $size: 12px;
        flex: 0 0 $size;
        width: $size;
        height: $size;
        background-image: url("/assets/locked.svg");
    }
</style>
