<script lang="ts">
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import {
        chatPermissionsList,
        communityPermissionsList,
        type ExternalBotPermissions,
        messagePermissionsList,
        type ResourceKey,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import BotPermissionsTabs from "./BotPermissionsTabs.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        permissions: ExternalBotPermissions;
        title: ResourceKey;
    }

    let { permissions, title }: Props = $props();
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

<Legend label={title}></Legend>
<BotPermissionsTabs>
    {#snippet chatTab()}
        {#each chatPermissionsList as perm}
            {@render check(
                i18nKey(`permissions.${perm}`),
                permissions.chatPermissions.includes(perm),
            )}
        {/each}
    {/snippet}
    {#snippet communityTab()}
        {#each communityPermissionsList as perm}
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
</BotPermissionsTabs>

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
