<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import type { UserSummary } from "openchat-shared";
    import User from "./User.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

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
