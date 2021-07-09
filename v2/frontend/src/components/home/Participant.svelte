<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { AvatarSize } from "../../domain/user/user";
    import type { UserLookup } from "../../domain/user/user";
    import Avatar from "../Avatar.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let participant: UserSummary;
    export let users: UserLookup;

    function removeUser() {
        dispatch("removeUser", participant);
    }

    function dismissAsAdmin() {
        dispatch("dismissAsAdmin", participant);
    }
</script>

<div class="participant">
    <span class="avatar">
        <Avatar
            url={avatarUrl(participant.userId)}
            status={getUserStatus(users, participant.userId)}
            size={AvatarSize.Small} />
    </span>
    <h4 class="details">
        {participant.username}
    </h4>
    <span class="menu">
        <MenuIcon>
            <span slot="icon">
                <HoverIcon>
                    <ChevronDown size={"1.2em"} color={"#aaa"} />
                </HoverIcon>
            </span>
            <span slot="menu">
                <Menu>
                    <MenuItem text="Remove" on:click={removeUser} />
                    <MenuItem text="Dismiss as admin" on:click={dismissAsAdmin} />
                </Menu>
            </span>
        </MenuIcon>
    </span>
</div>

<style type="text/scss">
    .participant {
        display: flex;
        margin-left: 10px;
        margin-right: 10px;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--participants-bd);
        background-color: var(--participants-bg);
        color: var(--participants-txt);
        padding: 10px;
        margin-bottom: 8px;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;

        &:hover,
        &.selected {
            background-color: var(--participants-hv);
        }
    }
    .avatar {
        flex: 0 0 50px;
    }
    .details {
        flex: 1;
        padding: 0 5px;
    }
    .menu {
        display: none;
        .participant:hover & {
            display: block;
        }
    }
</style>
