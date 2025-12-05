<script lang="ts">
    import { Body, ColourVars, Container, Switch } from "component-lib";
    import { i18nKey, type ExternalBotPermissions, type Level } from "openchat-client";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import { togglePermission } from "../../../utils/bots";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        level: Level;
        granted: ExternalBotPermissions;
        requested: ExternalBotPermissions;
    }

    let { granted = $bindable(), requested, level }: Props = $props();
</script>

{#snippet permHeader(title: string, Icon: any)}
    <Container gap={"sm"} crossAxisAlignment={"center"}>
        <Icon color={ColourVars.textSecondary} />
        <Body fontWeight={"bold"} colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey(title)}></Translatable>
        </Body>
    </Container>
{/snippet}

{#snippet noperm()}
    <Body>
        <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
    </Body>
{/snippet}

{#snippet chatTab()}
    <Container
        direction={"vertical"}
        borderRadius={"md"}
        padding={"lg"}
        gap={"lg"}
        background={ColourVars.background1}>
        {@render permHeader("Chat permissions", ForumOutline)}
        {#if requested.chatPermissions.length === 0}
            {@render noperm()}
        {:else}
            {#each requested.chatPermissions as perm}
                <Switch
                    reverse
                    width={"fill"}
                    onChange={() => togglePermission(granted, "chatPermissions", perm)}
                    checked={granted.chatPermissions.includes(perm)}>
                    <Translatable resourceKey={i18nKey(`permissions.${perm}`)} />
                </Switch>
            {/each}
        {/if}
    </Container>
{/snippet}
{#snippet communityTab()}
    <Container
        direction={"vertical"}
        borderRadius={"md"}
        padding={"lg"}
        gap={"lg"}
        background={ColourVars.background1}>
        {@render permHeader("Community permissions", AccountGroup)}
        {#if requested.communityPermissions.length === 0}
            {@render noperm()}
        {:else}
            {#each requested.communityPermissions as perm}
                <Switch
                    reverse
                    width={"fill"}
                    onChange={() => togglePermission(granted, "communityPermissions", perm)}
                    checked={granted.communityPermissions.includes(perm)}>
                    <Translatable resourceKey={i18nKey(`permissions.${perm}`)} />
                </Switch>
            {/each}
        {/if}
    </Container>
{/snippet}
{#snippet messageTab()}
    <Container
        direction={"vertical"}
        borderRadius={"md"}
        padding={"lg"}
        gap={"lg"}
        background={ColourVars.background1}>
        {@render permHeader("Message permissions", ChatOutline)}
        {#if requested.messagePermissions.length === 0}
            {@render noperm()}
        {:else}
            {#each requested.messagePermissions as perm}
                <Switch
                    reverse
                    width={"fill"}
                    onChange={() => togglePermission(granted, "messagePermissions", perm)}
                    checked={granted.messagePermissions.includes(perm)}>
                    <Translatable resourceKey={i18nKey(`permissions.messagePermissions.${perm}`)} />
                </Switch>
            {/each}
        {/if}
    </Container>
{/snippet}

{#if level !== "group"}
    {@render communityTab()}
{/if}
{@render chatTab()}
{@render messageTab()}
