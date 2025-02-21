<script lang="ts">
    import {
        i18nKey,
        type ExternalBotPermissions,
        type Level,
        type ResourceKey,
    } from "openchat-client";
    import Tabs from "../../Tabs.svelte";
    import Translatable from "../../Translatable.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import Legend from "../../Legend.svelte";
    import { togglePermission } from "../../../utils/bots";

    interface Props {
        level: Level;
        title: ResourceKey;
        subtitle: ResourceKey;
        granted: ExternalBotPermissions;
        requested: ExternalBotPermissions;
    }

    let { granted = $bindable(), requested, title, subtitle, level }: Props = $props();

    let initialIndex = $derived(level === "group" ? 1 : 2);

    function filterTabs<T>(tabs: T[]): T[] {
        if (level === "group") {
            return tabs.slice(1);
        }
        return tabs;
    }
</script>

{#snippet chatTab()}
    {#if requested.chatPermissions.length === 0}
        <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
    {:else}
        {#each requested.chatPermissions as perm}
            <Checkbox
                id={`chat_permission_${perm}`}
                label={i18nKey(`permissions.${perm}`)}
                checked={granted.chatPermissions.includes(perm)}
                on:change={() => togglePermission(granted, "chatPermissions", perm)}
                align={"start"}>
            </Checkbox>
        {/each}
    {/if}
{/snippet}
{#snippet communityTab()}
    {#if requested.communityPermissions.length === 0}
        <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
    {:else}
        {#each requested.communityPermissions as perm}
            <Checkbox
                id={`community_permission_${perm}`}
                label={i18nKey(`permissions.${perm}`)}
                checked={granted.communityPermissions.includes(perm)}
                on:change={() => togglePermission(granted, "communityPermissions", perm)}
                align={"start"}>
            </Checkbox>
        {/each}
    {/if}
{/snippet}
{#snippet messageTab()}
    {#if requested.messagePermissions.length === 0}
        <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
    {:else}
        {#each requested.messagePermissions as perm}
            <Checkbox
                id={`message_permission_${perm}`}
                label={i18nKey(`permissions.messagePermissions.${perm}`)}
                checked={granted.messagePermissions.includes(perm)}
                on:change={() => togglePermission(granted, "messagePermissions", perm)}
                align={"start"}>
            </Checkbox>
        {/each}
    {/if}
{/snippet}

<div class="permissions">
    <Legend large label={title}></Legend>
    <p class="info">
        <Translatable resourceKey={subtitle}></Translatable>
    </p>
    <Tabs
        {initialIndex}
        tabs={filterTabs([
            {
                title: i18nKey("bots.builder.permScopeCommunity"),
                snippet: communityTab,
            },
            {
                title: i18nKey("bots.builder.permScopeChat"),
                snippet: chatTab,
            },
            {
                title: i18nKey("bots.builder.permScopeMessage"),
                snippet: messageTab,
            },
        ])}></Tabs>
</div>

<style lang="scss">
    .info {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }
</style>
