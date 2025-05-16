<script lang="ts">
    import { iconSize } from "openchat-client";
    import type { UserSummary } from "openchat-shared";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";
    import User from "./User.svelte";

    interface Props {
        user: UserSummary;
        canUnblockUser?: boolean;
        searchTerm?: string;
        me?: boolean;
        onUnblockUser: (user: UserSummary) => void;
    }

    let {
        user,
        canUnblockUser = false,
        searchTerm = "",
        me = false,
        onUnblockUser,
    }: Props = $props();
</script>

<User {me} {user} {searchTerm}>
    {#if canUnblockUser}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                {#snippet menuIcon()}
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        <MenuItem onclick={() => onUnblockUser(user)}>
                            {#snippet icon()}
                                <Cancel size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("unblockUser")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    </Menu>
                {/snippet}
            </MenuIcon>
        </span>
    {/if}
</User>
