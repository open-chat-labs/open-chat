<script lang="ts">
    import { ui, type FullMember } from "openchat-client";
    import type { MemberRole } from "openchat-shared";
    import { _ } from "svelte-i18n";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
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
        me: boolean;
        member: FullMember;
        canPromoteToOwner?: boolean;
        canPromoteToAdmin?: boolean;
        canDemoteToAdmin?: boolean;
        canPromoteToModerator?: boolean;
        canDemoteToModerator?: boolean;
        canDemoteToMember?: boolean;
        canRemoveMember?: boolean;
        canBlockUser?: boolean;
        searchTerm?: string;
        onRemoveMember?: (userId: string) => void;
        onChangeRole?: (args: { userId: string; newRole: MemberRole; oldRole: MemberRole }) => void;
        onBlockUser?: (args: { userId: string }) => void;
    }

    let {
        me,
        member,
        canPromoteToOwner = false,
        canPromoteToAdmin = false,
        canDemoteToAdmin = false,
        canPromoteToModerator = false,
        canDemoteToModerator = false,
        canDemoteToMember = false,
        canRemoveMember = false,
        canBlockUser = false,
        searchTerm = "",
        onRemoveMember,
        onChangeRole,
        onBlockUser,
    }: Props = $props();

    // if search term is !== "", split the username into three parts [prefix, match, postfix]

    let showMenu = $derived(
        canPromoteToOwner ||
            canPromoteToAdmin ||
            canDemoteToAdmin ||
            canPromoteToModerator ||
            canDemoteToModerator ||
            canDemoteToMember ||
            canRemoveMember ||
            canBlockUser,
    );

    let ownerText = $derived($_("owner"));
    let adminText = $derived($_("admin"));
    let moderatorText = $derived($_("moderator"));
    let memberText = $derived($_("member"));

    function removeUser() {
        onRemoveMember?.(member.userId);
    }

    function changeRole(role: MemberRole) {
        onChangeRole?.({
            userId: member.userId,
            newRole: role,
            oldRole: member.role,
        });
    }

    function blockUser() {
        onBlockUser?.({ userId: member.userId });
    }
</script>

<User
    user={member}
    {me}
    {searchTerm}
    role={member.role === "moderator" || member.role === "admin" || member.role === "owner"
        ? member.role
        : undefined}>
    {#if showMenu}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                {#snippet menuIcon()}
                    <HoverIcon>
                        <ChevronDown size={ui.iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        {#if canPromoteToOwner}
                            <MenuItem onclick={() => changeRole("owner")}>
                                {#snippet icon()}
                                    <AccountPlusOutline
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable
                                            resourceKey={i18nKey("promoteTo", {
                                                role: ownerText,
                                            })} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if canPromoteToAdmin}
                            <MenuItem onclick={() => changeRole("admin")}>
                                {#snippet icon()}
                                    <AccountPlusOutline
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable
                                            resourceKey={i18nKey("promoteTo", {
                                                role: adminText,
                                            })} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if canDemoteToAdmin}
                            <MenuItem onclick={() => changeRole("admin")}>
                                {#snippet icon()}
                                    <AccountRemoveOutline
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable
                                            resourceKey={i18nKey("demoteTo", {
                                                role: adminText,
                                            })} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if canPromoteToModerator}
                            <MenuItem onclick={() => changeRole("moderator")}>
                                {#snippet icon()}
                                    <AccountPlusOutline
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable
                                            resourceKey={i18nKey("promoteTo", {
                                                role: moderatorText,
                                            })} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if canDemoteToModerator}
                            <MenuItem onclick={() => changeRole("moderator")}>
                                {#snippet icon()}
                                    <AccountRemoveOutline
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable
                                            resourceKey={i18nKey("demoteTo", {
                                                role: moderatorText,
                                            })} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if canDemoteToMember}
                            <MenuItem onclick={() => changeRole("member")}>
                                {#snippet icon()}
                                    <AccountRemoveOutline
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable
                                            resourceKey={i18nKey("demoteTo", {
                                                role: memberText,
                                            })} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if canBlockUser}
                            <MenuItem onclick={blockUser}>
                                {#snippet icon()}
                                    <Cancel size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <div>
                                        <Translatable resourceKey={i18nKey("blockUser")} />
                                    </div>
                                {/snippet}
                            </MenuItem>
                        {/if}
                        {#if canRemoveMember}
                            <MenuItem onclick={removeUser}>
                                {#snippet icon()}
                                    <MinusCircleOutline
                                        size={ui.iconSize}
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
