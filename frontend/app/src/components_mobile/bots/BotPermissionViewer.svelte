<script lang="ts">
    import { Body, Column, Row } from "component-lib";
    import {
        botChatPermissionList,
        botCommunityPermissionList,
        type ExternalBotPermissions,
        messagePermissionsList,
        type ResourceKey,
    } from "openchat-client";
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Tabs from "../Tabs.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        permissions: ExternalBotPermissions;
        title?: ResourceKey;
        nested?: boolean;
    }

    let { permissions, title, nested = false }: Props = $props();
</script>

{#snippet check(label: ResourceKey, requested: boolean)}
    <Row crossAxisAlignment={"center"} gap={"sm"}>
        {#if requested}
            <Check size={"1em"} color={"var(--success)"} />
        {:else}
            <Minus size={"1em"} color={"var(--txt-light)"} />
        {/if}
        <Body colour={requested ? "textPrimary" : "textSecondary"}>
            <Translatable resourceKey={label}></Translatable>
        </Body>
    </Row>
{/snippet}

{#snippet chatTab()}
    <Column gap={"sm"}>
        {#each botChatPermissionList as perm}
            {@render check(
                i18nKey(`permissions.${perm}`),
                permissions.chatPermissions.includes(perm),
            )}
        {/each}
    </Column>
{/snippet}
{#snippet communityTab()}
    <Column gap={"sm"}>
        {#each botCommunityPermissionList as perm}
            {@render check(
                i18nKey(`permissions.${perm}`),
                permissions.communityPermissions.includes(perm),
            )}
        {/each}
    </Column>
{/snippet}
{#snippet messageTab()}
    <Column gap={"sm"}>
        {#each messagePermissionsList as perm}
            {@render check(
                i18nKey(`permissions.messagePermissions.${perm}`),
                permissions.messagePermissions.includes(perm),
            )}
        {/each}
    </Column>
{/snippet}

{#if title !== undefined}
    <Body fontWeight={"bold"}>
        <Translatable resourceKey={title} />
    </Body>
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
