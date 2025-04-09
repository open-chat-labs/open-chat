<script lang="ts">
    import { ui } from "openchat-client";
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
        canUninviteUser?: boolean;
        searchTerm?: string;
        me?: boolean;
        onCancelInvite: (userId: string) => void;
    }

    let {
        user,
        canUninviteUser = false,
        searchTerm = "",
        me = false,
        onCancelInvite,
    }: Props = $props();

    function cancelInvite() {
        onCancelInvite(user.userId);
    }
</script>

<User {me} {user} {searchTerm}>
    {#if canUninviteUser}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                {#snippet menuIcon()}
                    <HoverIcon>
                        <ChevronDown size={ui.iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        <MenuItem onclick={cancelInvite}>
                            {#snippet icon()}
                                <Cancel size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <div>
                                    <Translatable resourceKey={i18nKey("cancelInvite")} />
                                </div>
                            {/snippet}
                        </MenuItem>
                    </Menu>
                {/snippet}
            </MenuIcon>
        </span>
    {/if}
</User>
