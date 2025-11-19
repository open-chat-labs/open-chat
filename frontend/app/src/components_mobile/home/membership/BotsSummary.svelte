<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import {
        botState,
        OpenChat,
        publish,
        selectedChatBotsStore,
        selectedChatWebhooksStore,
        type EnhancedExternalBot,
        type MultiUserChat,
        type WebhookDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import BotMember from "../../bots/BotMember.svelte";
    import WebhookMember from "../../bots/WebhookMember.svelte";
    import Translatable from "../../Translatable.svelte";
    import { MemberManagement } from "./membersState.svelte";

    const TO_SHOW = 5;

    interface Props {
        chat: MultiUserChat;
    }

    let { chat }: Props = $props();

    type EnhancedWebhook = WebhookDetails & { kind: "webhook" };
    type Item = EnhancedExternalBot | EnhancedWebhook;

    let membersState = new MemberManagement(getContext<OpenChat>("client"), chat);
    let canManageBots = $derived(membersState.canManageBots(chat.id));
    let botCount = $derived($selectedChatBotsStore.size + $selectedChatWebhooksStore.size);
    let more = $derived(botCount - TO_SHOW);
    let installedBots = $derived(
        membersState.hydrateBots($selectedChatBotsStore, botState.externalBots),
    );
    let installedHooks = $derived<EnhancedWebhook[]>(
        [...$selectedChatWebhooksStore.values()].map((h) => ({ ...h, kind: "webhook" })),
    );
    let items = $derived<Item[]>([...installedBots, ...installedHooks]);

    function showAllBots() {
        publish("groupMembers", { chat, view: "members" });
    }

    function addBots() {}
</script>

<Container gap={"xl"} direction={"vertical"}>
    <Container>
        <Body colour={"textSecondary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Bots & Webhooks")}></Translatable>
        </Body>

        {#if botCount > TO_SHOW}
            <CommonButton onClick={showAllBots} size={"small_text"} mode={"active"}>
                <Translatable resourceKey={i18nKey(`View all (+${more})`)}></Translatable>
            </CommonButton>
        {/if}
    </Container>

    <ListAction onClick={addBots}>
        {#snippet icon(color)}
            <Robot {color} />
        {/snippet}
        Add bots
    </ListAction>

    {#each items as item}
        {#if item.kind === "external_bot"}
            <BotMember
                collection={chat}
                bot={item}
                canManage={canManageBots}
                searchTerm={""}
                grantedPermissions={item.grantedPermissions} />
        {:else if item.kind === "webhook"}
            <WebhookMember {chat} webhook={item} searchTerm={""} />
        {/if}
    {/each}
</Container>
