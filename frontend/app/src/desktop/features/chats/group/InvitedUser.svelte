<script lang="ts">
    import { iconSize } from "@client";
    import type { UserSummary } from "@shared";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import HoverIcon from "@src/ui/HoverIcon.svelte";
    import Menu from "@src/desktop/shared/Menu.svelte";
    import MenuIcon from "@src/desktop/shared/MenuIcon.svelte";
    import MenuItem from "@src/desktop/shared/MenuItem.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
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
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        <MenuItem onclick={cancelInvite}>
                            {#snippet icon()}
                                <Cancel size={$iconSize} color={"var(--icon-inverted-txt)"} />
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
