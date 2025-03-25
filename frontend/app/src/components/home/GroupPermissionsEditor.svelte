<script lang="ts">
    import SelectPermissionRole from "./SelectPermissionRole.svelte";
    import { type ChatPermissions, chatRoles } from "openchat-client";
    import Toggle from "../Toggle.svelte";
    import TabHeader from "../TabHeader.svelte";
    import { i18nKey } from "../../i18n/i18n";

    interface Props {
        editing: boolean;
        permissions: ChatPermissions;
        isPublic: boolean;
        isCommunityPublic: boolean;
        isChannel: boolean;
        embeddedContent: boolean;
    }

    let {
        editing,
        permissions = $bindable(),
        isPublic,
        isCommunityPublic,
        isChannel,
        embeddedContent,
    }: Props = $props();

    let items = embeddedContent
        ? [i18nKey("permissions.general")]
        : [
              i18nKey("permissions.general"),
              i18nKey("permissions.message"),
              i18nKey("permissions.thread"),
          ];
    let selectedTab = $state(items[0].key);
    let roles = [...chatRoles];
    let overrideChatMessages = $state(permissions.threadPermissions !== undefined);

    $effect(() => {
        if (!editing) {
            permissions.mentionAllMembers = isPublic && isCommunityPublic ? "admin" : "member";
        }
    });

    function onOverrideChatMessagesChanged() {
        permissions.threadPermissions = overrideChatMessages
            ? structuredClone(permissions.messagePermissions)
            : undefined;
    }
</script>

<TabHeader bind:selected={selectedTab} {items} />

<div class="permissions">
    {#if selectedTab === "permissions.general"}
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.changeRoles")}
            bind:rolePermission={permissions.changeRoles} />
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.updateGroup")}
            bind:rolePermission={permissions.updateGroup} />
        {#if isChannel && !isCommunityPublic}
            <SelectPermissionRole
                {roles}
                label={i18nKey("permissions.addMembers")}
                bind:rolePermission={permissions.addMembers} />
        {/if}
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.inviteUsers")}
            bind:rolePermission={permissions.inviteUsers} />
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.removeMembers")}
            bind:rolePermission={permissions.removeMembers} />
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.deleteMessages")}
            bind:rolePermission={permissions.deleteMessages} />
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.startVideoCall")}
            bind:rolePermission={permissions.startVideoCall} />
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.pinMessages")}
            bind:rolePermission={permissions.pinMessages} />
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.reactToMessages")}
            bind:rolePermission={permissions.reactToMessages} />
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.mentionAllMembers", { mention: "@everyone" })}
            bind:rolePermission={permissions.mentionAllMembers} />
    {:else if selectedTab === "permissions.message"}
        <SelectPermissionRole
            {roles}
            label={i18nKey("permissions.messagePermissions.default")}
            bind:rolePermission={permissions.messagePermissions.default} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.text")}
            bind:rolePermission={permissions.messagePermissions.text} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.image")}
            bind:rolePermission={permissions.messagePermissions.image} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.video")}
            bind:rolePermission={permissions.messagePermissions.video} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.audio")}
            bind:rolePermission={permissions.messagePermissions.audio} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.file")}
            bind:rolePermission={permissions.messagePermissions.file} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.poll")}
            bind:rolePermission={permissions.messagePermissions.poll} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.crypto")}
            bind:rolePermission={permissions.messagePermissions.crypto} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.giphy")}
            bind:rolePermission={permissions.messagePermissions.giphy} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.prize")}
            bind:rolePermission={permissions.messagePermissions.prize} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.memeFighter")}
            bind:rolePermission={permissions.messagePermissions.memeFighter} />
        <SelectPermissionRole
            {roles}
            defaultRole={permissions.messagePermissions.default}
            label={i18nKey("permissions.messagePermissions.p2pSwap")}
            bind:rolePermission={permissions.messagePermissions.p2pSwap} />
    {:else if selectedTab === "permissions.thread"}
        <Toggle
            id="override-chat-messages"
            small
            on:change={onOverrideChatMessagesChanged}
            label={i18nKey("permissions.overrideChatMessages")}
            bind:checked={overrideChatMessages} />

        {#if permissions.threadPermissions !== undefined}
            <SelectPermissionRole
                {roles}
                label={i18nKey("permissions.threadPermissions.default")}
                bind:rolePermission={permissions.threadPermissions.default} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.text")}
                bind:rolePermission={permissions.threadPermissions.text} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.image")}
                bind:rolePermission={permissions.threadPermissions.image} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.video")}
                bind:rolePermission={permissions.threadPermissions.video} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.audio")}
                bind:rolePermission={permissions.threadPermissions.audio} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.file")}
                bind:rolePermission={permissions.threadPermissions.file} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.poll")}
                bind:rolePermission={permissions.threadPermissions.poll} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.crypto")}
                bind:rolePermission={permissions.threadPermissions.crypto} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.giphy")}
                bind:rolePermission={permissions.threadPermissions.giphy} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.prize")}
                bind:rolePermission={permissions.threadPermissions.prize} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.memeFighter")}
                bind:rolePermission={permissions.threadPermissions.memeFighter} />
            <SelectPermissionRole
                {roles}
                defaultRole={permissions.threadPermissions.default}
                label={i18nKey("permissions.threadPermissions.p2pSwap")}
                bind:rolePermission={permissions.threadPermissions.p2pSwap} />
        {/if}
    {/if}
</div>
