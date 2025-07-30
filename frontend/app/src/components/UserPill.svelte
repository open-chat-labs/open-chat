<script lang="ts">
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import {
        AvatarSize,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Avatar from "./Avatar.svelte";
    import Pill from "./Pill.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        userOrGroup: UserOrUserGroup;
        onDeleteUser: (user: UserOrUserGroup) => void;
    }

    let { userOrGroup, onDeleteUser }: Props = $props();

    let avatarUrl = $derived(
        userOrGroup.kind === "user_group" || userOrGroup.kind === "everyone"
            ? undefined
            : client.userAvatarUrl(userOrGroup),
    );
    let userId = $derived(client.userOrUserGroupId(userOrGroup));

    let name = $derived(client.userOrUserGroupName(userOrGroup));
    let displayName = $derived(
        userOrGroup.kind === "user_group" || userOrGroup.kind === "everyone"
            ? undefined
            : client.getDisplayName(
                  userOrGroup.userId,
                  $selectedCommunityMembersStore,
                  $selectedChatWebhooksStore,
              ),
    );
</script>

<Pill title={name}>
    <div class="avatar">
        <Avatar url={avatarUrl} {userId} size={AvatarSize.Small} />
    </div>
    <div class="name">
        {#if displayName !== undefined}
            <span>{displayName}</span>
        {/if}
        <span class="username">@{name}</span>
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="close" onclick={() => onDeleteUser(userOrGroup)}>
        <Close size={"1.2em"} color={"var(--button-txt)"} />
    </span>
</Pill>

<style lang="scss">
    .name {
        flex: auto;
        padding: $sp3;
    }

    .username {
        color: var(--button-disabled-txt);
    }

    .close {
        cursor: pointer;
        width: 20px;
        display: flex;
    }
</style>
