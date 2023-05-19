<svelte:options immutable={true} />

<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import type { FullMember } from "openchat-client";
    import type { MemberRole } from "openchat-shared";
    import User from "./User.svelte";

    const dispatch = createEventDispatcher();

    export let me: boolean;
    export let member: FullMember;
    export let canPromoteToOwner: boolean = false;
    export let canPromoteToAdmin: boolean = false;
    export let canDemoteToAdmin: boolean = false;
    export let canPromoteToModerator: boolean = false;
    export let canDemoteToModerator: boolean = false;
    export let canDemoteToMember: boolean = false;
    export let canRemoveMember: boolean = false;
    export let canBlockUser: boolean = false;
    export let searchTerm: string = "";

    // if search term is !== "", split the username into three parts [prefix, match, postfix]

    $: showMenu =
        canPromoteToOwner ||
        canPromoteToAdmin ||
        canDemoteToAdmin ||
        canPromoteToModerator ||
        canDemoteToModerator ||
        canDemoteToMember ||
        canRemoveMember ||
        canBlockUser;

    $: ownerText = $_("owner");
    $: adminText = $_("admin");
    $: moderatorText = $_("moderator");
    $: memberText = $_("member");

    function removeUser() {
        dispatch("removeMember", member.userId);
    }

    function changeRole(role: MemberRole) {
        dispatch("changeRole", { 
            userId: member.userId, 
            newRole: role, 
            oldRole: member.role
        });
    }

    function blockUser() {
        dispatch("blockUser", { userId: member.userId });
    }

    function openUserProfile() {
        dispatch("openUserProfile", member.userId);
    }
</script>

<User 
    user={member} 
    {me} 
    {searchTerm} 
    role={member.role === "moderator" || member.role === "admin" || member.role === "owner" ? member.role : undefined}
    on:open={openUserProfile}>
    {#if showMenu}
        <span class="menu">
            <MenuIcon>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        {#if canPromoteToOwner}
                            <MenuItem on:click={() => changeRole("owner")}>
                                <AccountPlusOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("promoteTo", { values: { role: ownerText } })}</div>
                            </MenuItem>
                        {/if}
                        {#if canPromoteToAdmin}
                            <MenuItem on:click={() => changeRole("admin")}>
                                <AccountPlusOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("promoteTo", { values: { role: adminText } })}</div>
                            </MenuItem>
                        {/if}
                        {#if canDemoteToAdmin}
                            <MenuItem on:click={() => changeRole("admin")}>
                                <AccountRemoveOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("demoteTo", { values: { role: adminText } })}</div>
                            </MenuItem>
                        {/if}
                        {#if canPromoteToModerator}
                            <MenuItem on:click={() => changeRole("moderator")}>
                                <AccountPlusOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("promoteTo", { values: { role: moderatorText } })}</div>
                            </MenuItem>
                        {/if}
                        {#if canDemoteToModerator}
                            <MenuItem on:click={() => changeRole("moderator")}>
                                <AccountRemoveOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("demoteTo", { values: { role: moderatorText } })}</div>
                            </MenuItem>
                        {/if}
                        {#if canDemoteToMember}
                            <MenuItem on:click={() => changeRole("participant")}>
                                <AccountRemoveOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("demoteTo", { values: { role: memberText } })}</div>
                            </MenuItem>
                        {/if}
                        {#if canBlockUser}
                            <MenuItem on:click={blockUser}>
                                <Cancel
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("blockUser")}</div>
                            </MenuItem>
                        {/if}
                        {#if canRemoveMember}
                            <MenuItem on:click={removeUser}>
                                <MinusCircleOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("remove")}</div>
                            </MenuItem>
                        {/if}
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</User>

