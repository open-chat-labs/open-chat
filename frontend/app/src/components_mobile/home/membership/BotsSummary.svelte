<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import {
        botState,
        OpenChat,
        type CommunitySummary,
        type EnhancedExternalBot,
        type MultiUserChat,
        type WebhookDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";
    import BotMember from "../../bots/BotMember.svelte";
    import WebhookMember from "../../bots/WebhookMember.svelte";
    import Translatable from "../../Translatable.svelte";
    import { MemberManagement } from "./membersState.svelte";

    const TO_SHOW = 5;

    interface Props {
        collection: MultiUserChat | CommunitySummary;
    }

    let { collection }: Props = $props();

    type EnhancedWebhook = WebhookDetails & { kind: "webhook" };
    type Item = EnhancedExternalBot | EnhancedWebhook;

    let title = $derived(collection.kind === "community" ? "Bots" : "Bots & Webhooks");
    let membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
    let canManageBots = $derived(membersState.canManageBots());
    let canRegisterWebhook = $derived(membersState.canRegisterWebhook());
    let botCount = $derived(membersState.bots.size + membersState.webhooks.size);
    let more = $derived(botCount - TO_SHOW);
    let installedBots = $derived(
        membersState.hydrateBots(membersState.bots, botState.externalBots),
    );
    let installedHooks = $derived<EnhancedWebhook[]>(
        [...membersState.webhooks.values()].map((h) => ({ ...h, kind: "webhook" })),
    );
    let items = $derived<Item[]>([...installedBots, ...installedHooks]);

    function showAllBots() {
        // TODO This is probably wrong
        membersState.showAllMembers();
    }

    function addBots() {}

    function registerHook() {}
</script>

<Container gap={"xl"} direction={"vertical"}>
    <Container>
        <Body colour={"textSecondary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey(title)}></Translatable>
        </Body>

        <CommonButton onClick={showAllBots} size={"small_text"} mode={"active"}>
            <Translatable resourceKey={i18nKey(`View all (${botCount})`)}></Translatable>
        </CommonButton>
    </Container>

    {#if canManageBots}
        <ListAction onClick={addBots}>
            {#snippet icon(color)}
                <Robot {color} />
            {/snippet}
            Add bots
        </ListAction>
    {/if}

    {#if canRegisterWebhook}
        <ListAction colour={"tertiary"} onClick={registerHook}>
            {#snippet icon(color)}
                <Webhook {color} />
            {/snippet}
            Register webhook
        </ListAction>
    {/if}

    {#each items as item}
        {#if item.kind === "external_bot"}
            <BotMember
                {collection}
                bot={item}
                canManage={canManageBots}
                searchTerm={""}
                grantedPermissions={item.grantedPermissions} />
        {:else if item.kind === "webhook" && collection.kind !== "community"}
            <WebhookMember
                canManage={canRegisterWebhook}
                chat={collection}
                webhook={item}
                searchTerm={""} />
        {/if}
    {/each}
</Container>
