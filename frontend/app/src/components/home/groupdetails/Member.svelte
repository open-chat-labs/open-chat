<svelte:options immutable />

<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import MenuIcon from "../../MenuIconLegacy.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItemLegacy.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import type { FullMember } from "openchat-client";
    import type { MemberRole } from "openchat-shared";
    import User from "./User.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

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
            oldRole: member.role,
        });
    }

    function blockUser() {
        dispatch("blockUser", { userId: member.userId });
    }
</script>

<User
    user={member}
    {me}
    {searchTerm}
    lapsed={member.lapsed}
    role={member.role === "moderator" || member.role === "admin" || member.role === "owner"
        ? member.role
        : undefined}>
    {#if showMenu}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        {#if canPromoteToOwner}
                            <MenuItem onclick={() => changeRole("owner")}>
                                <AccountPlusOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("promoteTo", { role: ownerText })} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if canPromoteToAdmin}
                            <MenuItem onclick={() => changeRole("admin")}>
                                <AccountPlusOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("promoteTo", { role: adminText })} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if canDemoteToAdmin}
                            <MenuItem onclick={() => changeRole("admin")}>
                                <AccountRemoveOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("demoteTo", { role: adminText })} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if canPromoteToModerator}
                            <MenuItem onclick={() => changeRole("moderator")}>
                                <AccountPlusOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("promoteTo", {
                                            role: moderatorText,
                                        })} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if canDemoteToModerator}
                            <MenuItem onclick={() => changeRole("moderator")}>
                                <AccountRemoveOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("demoteTo", {
                                            role: moderatorText,
                                        })} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if canDemoteToMember}
                            <MenuItem onclick={() => changeRole("member")}>
                                <AccountRemoveOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("demoteTo", { role: memberText })} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if canBlockUser}
                            <MenuItem onclick={blockUser}>
                                <Cancel
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable resourceKey={i18nKey("blockUser")} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if canRemoveMember}
                            <MenuItem onclick={removeUser}>
                                <MinusCircleOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable resourceKey={i18nKey("remove")} />
                                </div>
                            </MenuItem>
                        {/if}
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</User>
