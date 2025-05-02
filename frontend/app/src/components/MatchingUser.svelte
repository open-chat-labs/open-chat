<script lang="ts">
    import type { OpenChat, UserSummary } from "openchat-client";
    import { app, AvatarSize } from "openchat-client";
    import { getContext } from "svelte";
    import Avatar from "./Avatar.svelte";
    import FilteredUsername from "./FilteredUsername.svelte";
    import Badges from "./home/profile/Badges.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        searchTerm: string;
        user: UserSummary;
        hovering?: boolean;
        compact?: boolean;
        onSelect: (user: UserSummary) => void;
    }

    let {
        searchTerm,
        user,
        hovering = $bindable(false),
        compact = false,
        onSelect,
    }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="user"
    class:compact
    onclick={() => onSelect(user)}
    onmouseenter={() => (hovering = true)}
    onmouseleave={() => (hovering = false)}>
    <span class="avatar">
        <Avatar
            statusBorder={hovering ? "var(--members-hv)" : "transparent"}
            showStatus
            userId={user.userId}
            url={client.userAvatarUrl(user)}
            size={AvatarSize.Default} />
    </span>
    <div class="details">
        <h4>
            <FilteredUsername
                {searchTerm}
                me={user.userId === app.currentUserId}
                username={user.displayName ?? user.username} />
            <Badges
                uniquePerson={user.isUniquePerson}
                diamondStatus={user.diamondStatus}
                streak={client.getStreak(user.userId)} />
        </h4>
        <div class="username">
            <FilteredUsername {searchTerm} username={"@" + user.username} />
        </div>
    </div>
</div>

<style lang="scss">
    .user {
        display: flex;
        justify-content: center;
        align-items: center;
        color: var(--txt);
        padding: $sp4;
        margin: 0 0 $sp3 0;
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        cursor: pointer;
        gap: 12px;

        @include mobile() {
            padding: $sp3 toRem(10);
        }

        &.compact {
            margin: 0;
            padding: $sp3;
        }

        @media (hover: hover) {
            &:hover {
                background-color: var(--members-hv);
            }
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 0 5px;

        .username {
            font-weight: 200;
            color: var(--txt-light);
        }

        h4 {
            display: flex;
            gap: $sp2;
            align-items: center;
        }
    }
</style>
