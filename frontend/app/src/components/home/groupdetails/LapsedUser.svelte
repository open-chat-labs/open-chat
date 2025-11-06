<script lang="ts">
    import { iconSize } from "openchat-client";
    import type { UserSummary } from "openchat-shared";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";
    import User from "./User.svelte";

    interface Props {
        user: UserSummary;
        searchTerm?: string;
        me?: boolean;
        onBlockUser?: (userId: string) => void;
        onRemoveMember?: (userId: string) => void;
    }

    let { user, searchTerm = "", me = false, onBlockUser, onRemoveMember }: Props = $props();
</script>

<User {me} {user} {searchTerm}>
    {#if onBlockUser || onRemoveMember}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                {#snippet menuIcon()}
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        {#if onBlockUser}
                            <MenuItem onclick={() => onBlockUser(user.userId)}>
                                {#snippet icon()}
                                    <Cancel size={$iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable resourceKey={i18nKey("blockUser")} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if onRemoveMember}
                            <MenuItem onclick={() => onRemoveMember(user.userId)}>
                                {#snippet icon()}
                                    <MinusCircleOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable resourceKey={i18nKey("remove")} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                    </Menu>
                {/snippet}
            </MenuIcon>
        </span>
    {/if}
</User>
