<script lang="ts">
    import {
        iconSize,
        type FullMember,
        type MemberRole,
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_OWNER,
        roleAsText,
    } from "openchat-client";
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

    let ownerText = $derived($_(roleAsText(ROLE_OWNER)));
    let adminText = $derived($_(roleAsText(ROLE_ADMIN)));
    let moderatorText = $derived($_(roleAsText(ROLE_MODERATOR)));
    let memberText = $derived($_(roleAsText(ROLE_MEMBER)));

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
    role={member.role > ROLE_MEMBER
        ? roleAsText(member.role)
        : undefined}>
    {#if showMenu}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                {#snippet menuIcon()}
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        {#if canPromoteToOwner}
                            <MenuItem onclick={() => changeRole(ROLE_OWNER)}>
                                {#snippet icon()}
                                    <AccountPlusOutline
                                        size={$iconSize}
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
                            <MenuItem onclick={() => changeRole(ROLE_ADMIN)}>
                                {#snippet icon()}
                                    <AccountPlusOutline
                                        size={$iconSize}
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
                            <MenuItem onclick={() => changeRole(ROLE_ADMIN)}>
                                {#snippet icon()}
                                    <AccountRemoveOutline
                                        size={$iconSize}
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
                            <MenuItem onclick={() => changeRole(ROLE_MODERATOR)}>
                                {#snippet icon()}
                                    <AccountPlusOutline
                                        size={$iconSize}
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
                            <MenuItem onclick={() => changeRole(ROLE_MODERATOR)}>
                                {#snippet icon()}
                                    <AccountRemoveOutline
                                        size={$iconSize}
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
                            <MenuItem onclick={() => changeRole(ROLE_MEMBER)}>
                                {#snippet icon()}
                                    <AccountRemoveOutline
                                        size={$iconSize}
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
                                    <Cancel size={$iconSize} color={"var(--icon-inverted-txt)"} />
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
