<script lang="ts">
    import Avatar from "../Avatar.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { iconSize } from "../../stores/iconSize";
    import { AvatarSize } from "openchat-client";
    import SectionHeader from "../SectionHeader.svelte";
    import CurrentUserMenu from "./CurrentUserMenu.svelte";
</script>

<SectionHeader border={false}>
    <div class="current-selection" class:rtl={$rtlStore}>
        <div class="avatar">
            <Avatar
                url={"../assets/unknownUserAvatar.svg"}
                userId={undefined}
                size={AvatarSize.Default} />
        </div>
        <h4 class="name">{"OpenChat community"}</h4>
    </div>
    <span class="menu">
        <MenuIcon>
            <span slot="icon">
                <HoverIcon>
                    <Kebab size={$iconSize} color={"var(--icon-txt)"} />
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
    .current-selection {
        display: flex;
        flex: 1;
        align-items: center;
        gap: $sp4;
        cursor: pointer;

        @include mobile() {
            padding: 0 $sp3;
        }
    }
</style>
