<script lang="ts">
    import { MenuItem } from "component-lib";
    import {
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_OWNER,
        roleAsText,
        type FullMember,
        type MemberRole,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import AccountRemoveOutline from "svelte-material-icons/AccountRemoveOutline.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
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
        onBlockUser?: (userId: string) => void;
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
        onBlockUser?.(member.userId);
    }
</script>

<User user={member} {me} {searchTerm} role={member.role > ROLE_MEMBER ? member.role : undefined}>
    {#if showMenu}
        {#if canPromoteToOwner}
            <MenuItem onclick={() => changeRole(ROLE_OWNER)}>
                {#snippet icon(color, size)}
                    <AccountPlusOutline {size} {color} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("promoteTo", {
                        role: ownerText,
                    })} />
            </MenuItem>
        {/if}
        {#if canPromoteToAdmin}
            <MenuItem onclick={() => changeRole(ROLE_ADMIN)}>
                {#snippet icon(color, size)}
                    <AccountPlusOutline {size} {color} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("promoteTo", {
                        role: adminText,
                    })} />
            </MenuItem>
        {/if}
        {#if canDemoteToAdmin}
            <MenuItem onclick={() => changeRole(ROLE_ADMIN)}>
                {#snippet icon(color, size)}
                    <AccountRemoveOutline {size} {color} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("demoteTo", {
                        role: adminText,
                    })} />
            </MenuItem>
        {/if}
        {#if canPromoteToModerator}
            <MenuItem onclick={() => changeRole(ROLE_MODERATOR)}>
                {#snippet icon(color, size)}
                    <AccountPlusOutline {size} {color} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("promoteTo", {
                        role: moderatorText,
                    })} />
            </MenuItem>
        {/if}
        {#if canDemoteToModerator}
            <MenuItem onclick={() => changeRole(ROLE_MODERATOR)}>
                {#snippet icon(color, size)}
                    <AccountRemoveOutline {size} {color} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("demoteTo", {
                        role: moderatorText,
                    })} />
            </MenuItem>
        {/if}
        {#if canDemoteToMember}
            <MenuItem onclick={() => changeRole(ROLE_MEMBER)}>
                {#snippet icon(color, size)}
                    <AccountRemoveOutline {size} {color} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey("demoteTo", {
                        role: memberText,
                    })} />
            </MenuItem>
        {/if}
        {#if canBlockUser}
            <MenuItem onclick={blockUser}>
                {#snippet icon(color, size)}
                    <Cancel {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("blockUser")} />
            </MenuItem>
        {/if}
        {#if canRemoveMember}
            <MenuItem onclick={removeUser}>
                {#snippet icon(color, size)}
                    <MinusCircleOutline {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("remove")} />
            </MenuItem>
        {/if}
    {/if}
</User>
