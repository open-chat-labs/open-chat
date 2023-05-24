<script lang="ts">
    import Avatar from "../Avatar.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { iconSize } from "../../stores/iconSize";
    import { AvatarSize, OpenChat, PartialUserSummary } from "openchat-client";
    import SectionHeader from "../SectionHeader.svelte";
    import CurrentUserMenu from "./CurrentUserMenu.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;
</script>

<SectionHeader border={false}>
    <div class="current-user" class:rtl={$rtlStore} on:click={() => dispatch("profile")}>
        <div class="avatar">
            <Avatar
                url={client.userAvatarUrl(user)}
                userId={user.userId}
                size={AvatarSize.Default} />
        </div>
        <h4 class:diamond={user.diamond} class="name">{user.username}</h4>
    </div>
    <span on:click={() => dispatch("wallet")}>
        <HoverIcon>
            <Wallet size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <span class="menu">
        <MenuIcon position={"bottom"} align={"end"}>
            <span slot="icon">
                <HoverIcon>
                    <Hamburger size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </span>
            <span slot="menu">
                <CurrentUserMenu
                    on:halloffame
                    on:logout
                    on:newGroup
                    on:profile
                    on:showHomePage
                    on:upgrade
                    on:wallet
                    on:whatsHot />
            </span>
        </MenuIcon>
    </span>
</SectionHeader>

<style type="text/scss">
    .current-user {
        display: flex;
        flex: 1;
        align-items: center;
        gap: $sp4;
        cursor: pointer;

        @include mobile() {
            padding: 0 $sp3;
        }
    }
    .diamond {
        @include diamond();
    }
</style>
