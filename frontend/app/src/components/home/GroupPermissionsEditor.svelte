<script lang="ts">
    import { _ } from "svelte-i18n";
    import SelectPermissionRole from "./SelectPermissionRole.svelte";
    import { type ChatPermissions, chatRoles } from "openchat-client";
    import Toggle from "../Toggle.svelte";
    import TabHeader from "../TabHeader.svelte";

    export let permissions: ChatPermissions;
    export let isPublic: boolean;
    export let isCommunityPublic: boolean;

    let selectedTab = 0;
    let roles = [...chatRoles];
    let overrideChatMessages = permissions.threadPermissions !== undefined;

    $: {
        if (isPublic && isCommunityPublic) {
            permissions.mentionAllMembers = "admin";
        } else {
            permissions.mentionAllMembers = "member";
        }
    }

    function onOverrideChatMessagesChanged() {
        permissions.threadPermissions = overrideChatMessages ? { default: "member" } : undefined;
    }
</script>

<TabHeader
    bind:selected={selectedTab}
    items={[$_("permissions.general"), $_("permissions.message"), $_("permissions.thread")]} />

<div class="permissions">
    {#if selectedTab === 0}
        <SelectPermissionRole
            {roles}
            label={$_("permissions.changeRoles")}
            bind:rolePermission={permissions.changeRoles} />
        <SelectPermissionRole
            {roles}
            label={$_("permissions.updateGroup")}
            bind:rolePermission={permissions.updateGroup} />
        {#if !isPublic}
            <SelectPermissionRole
                {roles}
                label={$_("permissions.inviteUsers")}
                bind:rolePermission={permissions.inviteUsers} />
        {/if}
        <SelectPermissionRole
            {roles}
            label={$_("permissions.removeMembers")}
            bind:rolePermission={permissions.removeMembers} />
        <SelectPermissionRole
            {roles}
            label={$_("permissions.deleteMessages")}
            bind:rolePermission={permissions.deleteMessages} />
        <SelectPermissionRole
            {roles}
            label={$_("permissions.pinMessages")}
            bind:rolePermission={permissions.pinMessages} />
        <SelectPermissionRole
            {roles}
            label={$_("permissions.reactToMessages")}
            bind:rolePermission={permissions.reactToMessages} />
        <SelectPermissionRole
            {roles}
            label={$_("permissions.mentionAllMembers", { values: { mention: "@everyone" } })}
            bind:rolePermission={permissions.mentionAllMembers} />
    {:else if selectedTab === 1}
        <SelectPermissionRole
            {roles}
            label={$_("permissions.messagePermissions.default")}
            bind:rolePermission={permissions.messagePermissions.default} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.text")}
            bind:rolePermission={permissions.messagePermissions.text} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.image")}
            bind:rolePermission={permissions.messagePermissions.image} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.video")}
            bind:rolePermission={permissions.messagePermissions.video} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.audio")}
            bind:rolePermission={permissions.messagePermissions.audio} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.file")}
            bind:rolePermission={permissions.messagePermissions.file} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.poll")}
            bind:rolePermission={permissions.messagePermissions.poll} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.crypto")}
            bind:rolePermission={permissions.messagePermissions.crypto} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.giphy")}
            bind:rolePermission={permissions.messagePermissions.giphy} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.prize")}
            bind:rolePermission={permissions.messagePermissions.prize} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={$_("permissions.messagePermissions.memeFighter")}
            bind:rolePermission={permissions.messagePermissions.memeFighter} />
    {:else if selectedTab === 2}
        <Toggle
            id="override-chat-messages"
            small
            on:change={onOverrideChatMessagesChanged}
            label={$_("permissions.overrideChatMessages")}
            bind:checked={overrideChatMessages} />

        {#if permissions.threadPermissions !== undefined}
            <SelectPermissionRole
                {roles}
                label={$_("permissions.threadPermissions.default")}
                bind:rolePermission={permissions.threadPermissions.default} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.text")}
                bind:rolePermission={permissions.threadPermissions.text} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.image")}
                bind:rolePermission={permissions.threadPermissions.image} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.video")}
                bind:rolePermission={permissions.threadPermissions.video} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.audio")}
                bind:rolePermission={permissions.threadPermissions.audio} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.file")}
                bind:rolePermission={permissions.threadPermissions.file} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.poll")}
                bind:rolePermission={permissions.threadPermissions.poll} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.crypto")}
                bind:rolePermission={permissions.threadPermissions.crypto} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.giphy")}
                bind:rolePermission={permissions.threadPermissions.giphy} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.prize")}
                bind:rolePermission={permissions.threadPermissions.prize} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={$_("permissions.threadPermissions.memeFighter")}
                bind:rolePermission={permissions.threadPermissions.memeFighter} />
        {/if}
    {/if}
</div>
