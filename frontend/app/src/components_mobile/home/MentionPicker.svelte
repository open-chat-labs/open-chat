<script lang="ts">
    import { Avatar, Body, ColourVars, Column, MenuItem, Row } from "component-lib";
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import { allUsersStore, iconSize, selectedCommunityMembersStore } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
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
                <Column
                    borderRadius={"md"}
                    backgroundColor={ColourVars.background1}
                    width={"fill"}
                    height={"fill"}>
                    {#each filtered as item, itemIndex (userOrGroupKey(item))}
                        <MenuItem selected={itemIndex === index} onclick={() => mention(item)}>
                            {#snippet icon()}
                                {#if item.kind === "user_group" || item.kind === "everyone"}
                                    <div class="group-icon">
                                        <AccountMultiple
                                            color={"var(--menu-disabled-txt)"}
                                            size={$iconSize} />
                                    </div>
                                {:else}
                                    <Avatar
                                        url={client.userAvatarUrl($allUsersStore.get(item.userId))}
                                        size={"sm"} />
                                {/if}
                            {/snippet}
                            <Row gap={"xs"} crossAxisAlignment={"center"}>
                                {#if item.kind === "user_group"}
                                    <Body width={"hug"}>
                                        {item.name}
                                    </Body>
                                {:else if item.kind === "everyone"}
                                    <Body width={"hug"}>
                                        {"everyone"}
                                    </Body>
                                {:else}
                                    <Body width={"hug"}>
                                        {client.getDisplayName(
                                            item.userId,
                                            $selectedCommunityMembersStore,
                                        )}
                                    </Body>
                                    <Body colour={"textSecondary"} width={"hug"}>
                                        @{item.username}
                                    </Body>
                                {/if}
                            </Row>
                        </MenuItem>
                    {/each}
                </Column>
            </div>
        {/if}
    {/snippet}
</MentionPickerLogic>

<style lang="scss">
    .mention-picker {
        @include z-index("footer-overlay");
        position: absolute;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow: auto;
        z-index: 10000;

        &.inline {
            position: relative;
            box-shadow: none;
        }
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
