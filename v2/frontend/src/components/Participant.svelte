<script lang="ts">
    import type { Participant } from "../services/chats";
    import { AvatarSize, UserStatus } from "../services/user";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Avatar from "./Avatar.svelte";
    import MenuIcon from "./MenuIcon.svelte";
    import HoverIcon from "./HoverIcon.svelte";
    import Menu from "./Menu.svelte";
    import MenuItem from "./MenuItem.svelte";

    export let participant: Participant;
</script>

<div class="participant">
    <span class="avatar">
        <Avatar url={participant.avatar} status={UserStatus.Online} size={AvatarSize.Small} />
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
                    <MenuItem text="Remove" on:click={() => console.log("one")} />
                    <MenuItem text="Dismiss as admin" on:click={() => console.log("two")} />
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
