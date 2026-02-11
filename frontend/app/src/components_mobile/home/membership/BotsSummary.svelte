<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import {
        botState,
        OpenChat,
        publish,
        type CommunitySummary,
        type MultiUserChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";
    import BotMember from "../../bots/BotMember.svelte";
    import WebhookMember from "../../bots/WebhookMember.svelte";
    import Translatable from "../../Translatable.svelte";
    import Separator from "../Separator.svelte";
    import { MemberManagement } from "./membersState.svelte";

    interface Props {
        collection: MultiUserChat | CommunitySummary;
    }

    let { collection }: Props = $props();

    let title = $derived(collection.kind === "community" ? "Bots" : "Bots & Webhooks");
    let membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
    let canManageBots = $derived(membersState.canManageBots());
    let canRegisterWebhook = $derived(membersState.canRegisterWebhook());
    let botCount = $derived(membersState.bots.size + membersState.webhooks.size);
    let installedBots = $derived(
        membersState.hydrateBots(membersState.bots, botState.externalBots),
    );
    let installedHooks = $derived([...membersState.webhooks.values()]);
    let empty = $derived(
        !canManageBots && (!canRegisterWebhook || collection.kind === "community"),
    );

    function showAllBots() {
        publish("showBots", collection);
    }

    function registerHook() {
        if (collection.kind !== "community") {
            publish("registerWebhook", collection);
        }
    }
</script>

{#if !empty}
    <Separator />

    <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
        <Container>
            <Body colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(title)}></Translatable>
            </Body>

            <CommonButton onClick={showAllBots} size={"small_text"} mode={"active"}>
                <Translatable resourceKey={i18nKey(`View all (${botCount})`)}></Translatable>
            </CommonButton>
        </Container>

        {#if canManageBots}
            <ListAction onClick={showAllBots}>
                {#snippet icon(color)}
                    <Robot {color} />
                {/snippet}
                Add bots
            </ListAction>
        {/if}

        {#if collection.kind !== "community" && canRegisterWebhook}
            <ListAction colour={"tertiary"} onClick={registerHook}>
                {#snippet icon(color)}
                    <Webhook {color} />
                {/snippet}
                Register webhook
            </ListAction>
        {/if}

        {#each installedBots as bot}
            {#if bot.kind === "external_bot"}
                <BotMember
                    {collection}
                    {bot}
                    canManage={canManageBots}
                    searchTerm={""}
                    grantedPermissions={bot.grantedPermissions} />
            {:else if bot.kind === "webhook" && collection.kind !== "community"}
                <WebhookMember
                    canManage={canRegisterWebhook}
                    chat={collection}
                    webhook={bot}
                    searchTerm={""} />
            {/if}
        {/each}

        {#if collection.kind !== "community" && canRegisterWebhook}
            {#each installedHooks as hook}
                <WebhookMember
                    canManage={canRegisterWebhook}
                    chat={collection}
                    webhook={hook}
                    searchTerm={""} />
            {/each}
        {/if}
    </Container>
{/if}
