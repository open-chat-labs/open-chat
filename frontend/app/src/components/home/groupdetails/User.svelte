<svelte:options immutable />

<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { AvatarSize, currentCommunityMembers as communityMembers } from "openchat-client";
    import FilteredUsername from "../../FilteredUsername.svelte";
    import type { UserSummary } from "openchat-shared";
    import type { ProfileLinkClickedEvent } from "../../web-components/profileLink";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Badges from "../profile/Badges.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let user: UserSummary;
    export let me: boolean = false;
    export let searchTerm: string = "";
    export let role: string | undefined = undefined;
    export let profile = true;
    export let lapsed = false;

    // if search term is !== "", split the username into three parts [prefix, match, postfix]

    let hovering = false;

    $: displayName = client.getDisplayName(user, $communityMembers);

    function onClick(ev: Event) {
        if (profile) {
            ev.target?.dispatchEvent(
                new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                    detail: {
                        userId: user.userId,
                        chatButton: !me,
                        inGlobalContext: false,
                    },
                    bubbles: true,
                }),
            );
        }

        dispatch("click");
    }
</script>

<!-- svelte-ignore a11y-interactive-supports-focus -->
<div
    class="member"
    class:me
    on:click={onClick}
    role="button"
    on:mouseenter={() => (hovering = true)}
    on:mouseleave={() => (hovering = false)}>
    <span class="avatar">
        <Avatar
            statusBorder={hovering && !me ? "var(--members-hv)" : "transparent"}
            userId={user.userId}
            url={client.userAvatarUrl(user)}
            size={AvatarSize.Default} />
    </span>
    <div class="details">
        <div class="display-name">
            <h4>
                <FilteredUsername {searchTerm} username={displayName} {me} />
                <Badges
                    uniquePerson={user.isUniquePerson}
                    diamondStatus={user.diamondStatus}
                    streak={user.streak} />
            </h4>
            {#if role !== undefined}
                <span class="role">
                    (<Translatable resourceKey={i18nKey(role)} />)
                </span>
            {/if}
        </div>
        <div class="username">
            <FilteredUsername {searchTerm} username={"@" + user.username} />
        </div>
    </div>
    <slot />
</div>

<style lang="scss">
    .member {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        gap: 12px;

        &:not(.me) {
            cursor: pointer;
        }

        @media (hover: hover) {
            &:not(.me):hover {
                background-color: var(--members-hv);
            }
        }

        @include mobile() {
            padding: $sp3 toRem(10);
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
    }

    .details {
        display: flex;
        flex: 1;
        flex-direction: column;
        @include font(medium, normal, fs-100);

        .display-name {
            display: flex;
            flex: 1;
            align-items: center;
            @include ellipsis();

            h4 {
                display: flex;
                align-items: center;
                gap: $sp2;
            }
        }

        .username {
            font-weight: 200;
            color: var(--txt-light);
        }
    }

    .role {
        margin: 0 $sp3;
        @include font(light, normal, fs-70);
    }
</style>
