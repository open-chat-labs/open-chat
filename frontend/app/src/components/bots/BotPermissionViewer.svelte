<script lang="ts">
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import {
        botChatPermissionList,
        botCommunityPermissionList,
        type ExternalBotPermissions,
        messagePermissionsList,
        type ResourceKey,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import Translatable from "../Translatable.svelte";
    import Tabs from "../Tabs.svelte";

    interface Props {
        permissions: ExternalBotPermissions;
        title?: ResourceKey;
        nested?: boolean;
    }

    let { permissions, title, nested = false }: Props = $props();
</script>

{#snippet check(label: ResourceKey, requested: boolean)}
    <div class="perm" class:disabled={!requested}>
        <div class="check">
            {#if requested}
                <Check size={"1em"} color={"limegreen"} />
            {:else}
                <Minus size={"1em"} color={"var(--txt-light)"} />
            {/if}
        </div>
        <div class="label">
            <Translatable resourceKey={label}></Translatable>
        </div>
    </div>
{/snippet}

{#snippet chatTab()}
    {#each botChatPermissionList as perm}
        {@render check(i18nKey(`permissions.${perm}`), permissions.chatPermissions.includes(perm))}
    {/each}
{/snippet}
{#snippet communityTab()}
    {#each botCommunityPermissionList as perm}
        {@render check(
            i18nKey(`permissions.${perm}`),
            permissions.communityPermissions.includes(perm),
        )}
    {/each}
{/snippet}
{#snippet messageTab()}
    {#each messagePermissionsList as perm}
        {@render check(
            i18nKey(`permissions.messagePermissions.${perm}`),
            permissions.messagePermissions.includes(perm),
        )}
    {/each}
{/snippet}

{#if title !== undefined}
    <Legend label={title}></Legend>
{/if}
<Tabs
    {nested}
    initialIndex={2}
    tabs={[
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
    ]}></Tabs>

<style lang="scss">
    .perm {
        display: flex;
        gap: $sp3;
        align-items: center;

        &.disabled {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
        }
    }
</style>
