<script lang="ts">
    import {
        currentUser,
        emptyBotInstance,
        externalBots,
        OpenChat,
        type BotMatch,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import BotBuilder from "./AutoBotBuilder.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { getContext } from "svelte";
    import { toastStore } from "../../stores/toast";
    import ButtonGroup from "../ButtonGroup.svelte";
    import AlertBox from "../AlertBox.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        mode: "register" | "update";
    }

    let { onClose, mode = "register" }: Props = $props();

    let valid = $state(false);
    let busy = $state(false);
    let step: "choose" | "edit" = $state(mode === "update" ? "choose" : "edit");

    let botState = $state({
        original: emptyBotInstance(),
        current: emptyBotInstance(),
    });

    let ownerDirty = $derived(botState.original.ownerId !== botState.current.ownerId);
    let nameDirty = $derived(botState.original.name !== botState.current.name);
    let avatarDirty = $derived(botState.original.avatarUrl !== botState.current.avatarUrl);
    let endpointDirty = $derived(botState.original.endpoint !== botState.current.endpoint);
    let dirty = $derived(ownerDirty || nameDirty || avatarDirty || endpointDirty);

    let myBots = $derived(
        mode === "update"
            ? [...$externalBots.values()].filter((b) => b.ownerId === $currentUser.userId)
            : [],
    );

    function register() {
        if (botState.current !== undefined && valid) {
            busy = true;
            const snapshot = $state.snapshot(botState.current);
            client
                .registerBot({
                    ...snapshot,
                    ownerId: $currentUser.userId,
                })
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("Unable to register test bot"));
                    } else {
                        console.log("Bot registered");
                        onClose();
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function update() {
        if (botState.current !== undefined && valid) {
            busy = true;
            const { id, ownerId, name, avatarUrl, endpoint } = $state.snapshot(botState.current);
            client
                .updateRegisteredBot(
                    id,
                    ownerDirty ? ownerId : undefined,
                    nameDirty ? name : undefined,
                    avatarDirty ? avatarUrl : undefined,
                    endpointDirty ? endpoint : undefined,
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("Unable to register test bot"));
                    } else {
                        console.log("Bot registered");
                        onClose();
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function selectBot({ id }: BotMatch) {
        const b = $externalBots.get(id);
        if (b !== undefined) {
            if (b.ownerId === $currentUser.userId) {
                botState.original = b;
                botState.current = structuredClone(b);
                step = "edit";
            }
        }
    }
</script>

<ModalContent on:close={onClose}>
    <div class="header" slot="header">
        <Translatable resourceKey={i18nKey("bots.builder.title")}></Translatable>
    </div>
    <div class="body" slot="body">
        {#if step === "choose"}
            {#if myBots.length === 0}
                <AlertBox>
                    <Translatable resourceKey={i18nKey("bots.update_bot.nobots")}></Translatable>
                </AlertBox>
            {:else}
                <AlertBox>
                    <Translatable resourceKey={i18nKey("bots.update_bot.select")}></Translatable>
                </AlertBox>
                {#each myBots as myBot}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div onclick={() => selectBot(myBot)} class="match">
                        <h2>{myBot.name}</h2>
                    </div>
                {/each}
            {/if}
        {:else if step === "edit" && botState.current !== undefined}
            <BotBuilder
                candidate={botState.current}
                {mode}
                onUpdate={(b) => (botState.current = b)}
                bind:valid />
        {/if}
    </div>
    <div class="footer" slot="footer">
        <ButtonGroup>
            <Button secondary small={!$mobileWidth} tiny={$mobileWidth} on:click={onClose}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </Button>
            <Button
                on:click={mode === "update" ? update : register}
                disabled={!valid || busy || !dirty}
                loading={busy}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
                <Translatable
                    resourceKey={mode === "update"
                        ? i18nKey("bot.update_bot.action")
                        : i18nKey("bot.add.action")} />
            </Button>
        </ButtonGroup>
    </div>
</ModalContent>
