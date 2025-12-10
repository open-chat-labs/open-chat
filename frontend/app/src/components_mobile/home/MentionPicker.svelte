<script lang="ts">
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import {
        allUsersStore,
        AvatarSize,
        iconSize,
        selectedCommunityMembersStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Avatar from "../Avatar.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import VirtualList from "../VirtualList.svelte";
    import MentionPickerLogic from "./MentionPickerLogic.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        prefix: string | undefined;
        offset: number;
        direction?: "up" | "down";
        border?: boolean;
        mentionSelf?: boolean;
        supportsUserGroups?: boolean;
        usersOnly?: boolean;
        inline?: boolean;
        onMention: (user: UserOrUserGroup) => void;
    }

    let {
        prefix,
        offset,
        direction = "up",
        border = false,
        mentionSelf = false,
        supportsUserGroups = false,
        usersOnly = false,
        inline = false,
        onMention,
    }: Props = $props();
</script>

<MentionPickerLogic
    {prefix}
    {offset}
    {direction}
    {border}
    {mentionSelf}
    {supportsUserGroups}
    {usersOnly}
    {inline}
    {onMention}>
    {#snippet children(userOrGroupKey, mention, filtered, direction, inline, border, style, index)}
        {#if filtered.length > 0}
            <div
                class="mention-picker"
                class:up={direction === "up"}
                class:down={direction === "down"}
                class:inline
                class:border
                {style}>
                <Menu fit>
                    <VirtualList keyFn={userOrGroupKey} items={filtered}>
                        {#snippet children(item, itemIndex)}
                            <MenuItem selected={itemIndex === index} onclick={() => mention(item)}>
                                {#snippet icon()}
                                    <div class="avatar">
                                        {#if item.kind === "user_group" || item.kind === "everyone"}
                                            <div class="group-icon">
                                                <AccountMultiple
                                                    color={"var(--menu-disabled-txt)"}
                                                    size={$iconSize} />
                                            </div>
                                        {:else}
                                            <Avatar
                                                url={client.userAvatarUrl(
                                                    $allUsersStore.get(item.userId),
                                                )}
                                                userId={item.userId}
                                                size={AvatarSize.Small} />
                                        {/if}
                                    </div>
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        {#if item.kind === "user_group"}
                                            <span class="display-name">
                                                {item.name}
                                            </span>
                                        {:else if item.kind === "everyone"}
                                            <span class="display-name">
                                                {"everyone"}
                                            </span>
                                        {:else}
                                            <span class="display-name">
                                                {client.getDisplayName(
                                                    item.userId,
                                                    $selectedCommunityMembersStore,
                                                )}
                                            </span>
                                            <span class="username">
                                                @{item.username}
                                            </span>
                                        {/if}
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/snippet}
                    </VirtualList>
                </Menu>
            </div>
        {/if}
    {/snippet}
</MentionPickerLogic>

<style lang="scss">
    :global(.mention-picker .menu) {
        box-shadow: none;
        position: relative;
        width: 100%;
        height: 100%;
        @include z-index("footer-overlay");
    }

    .mention-picker {
        position: absolute;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow: auto;
        z-index: 10000;

        &.up {
            box-shadow: var(--menu-inverted-sh);
        }

        &.down {
            box-shadow: var(--menu-sh);
        }

        &.inline {
            position: relative;
            box-shadow: none;
        }

        &.border {
            border: 1px solid var(--bd);
            border-top: none;
        }

        .display-name {
            font-weight: 500;
        }

        .username {
            font-weight: 200;
            color: var(--menu-disabled-txt);
        }
    }
    .avatar {
        margin-right: $sp3;
    }

    .group-icon {
        width: toRem(35);
        height: toRem(35);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--menu-bg);
        border-radius: 50%;
    }
</style>
