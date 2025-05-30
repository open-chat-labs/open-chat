<script lang="ts">
    import {
        currentUserIdStore,
        emptyBotInstance,
        mobileWidth,
        OpenChat,
        type ExternalBot,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import BotBuilder from "./AutoBotBuilder.svelte";
    import ChooseBot from "./ChooseBot.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        mode: "register" | "update" | "remove";
    }

    let { onClose, mode = "register" }: Props = $props();

    let principal = $state("");
    let valid = $state(false);
    let schemaLoaded = $state(false);
    let busy = $state(false);
    let step: "choose" | "edit" = $state(
        mode === "update" || mode === "remove" ? "choose" : "edit",
    );

    let botState = $state({
        original: emptyBotInstance($currentUserIdStore),
        current: emptyBotInstance($currentUserIdStore),
    });

    let ownerDirty = $derived(botState.original.ownerId !== botState.current.ownerId);
    let nameDirty = $derived(botState.original.name !== botState.current.name);
    let avatarDirty = $derived(botState.original.avatarUrl !== botState.current.avatarUrl);
    let endpointDirty = $derived(botState.original.endpoint !== botState.current.endpoint);
    // let dirty = $derived(ownerDirty || nameDirty || avatarDirty || endpointDirty);

    function register() {
        if (botState.current !== undefined && valid) {
            busy = true;
            client
                .registerBot(principal, botState.current)
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("Unable to register bot"));
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
            const { id, ownerId, avatarUrl, endpoint, definition } = $state.snapshot(
                botState.current,
            );
            client
                .updateRegisteredBot(
                    id,
                    principal !== "" ? principal : undefined,
                    ownerDirty ? ownerId : undefined,
                    avatarDirty ? avatarUrl : undefined,
                    endpointDirty ? endpoint : undefined,
                    definition,
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

    function remove(id: string) {
        busy = true;
        client
            .removeBot(id)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("Unable to remove bot"));
                } else {
                    console.log("Bot removed");
                    onClose();
                }
            })
            .finally(() => (busy = false));
    }

    function selectBot(bot: ExternalBot) {
        if (bot.ownerId === $currentUserIdStore) {
            botState.original = bot;
            botState.current = structuredClone(bot);
            if (mode === "update") {
                step = "edit";
            } else if (mode === "remove") {
                remove(bot.id);
            }
        }
    }

    let titleKey = $derived.by(() => {
        switch (mode) {
            case "register":
                return i18nKey("bots.builder.title");
            case "update":
                return step === "choose"
                    ? i18nKey("bots.update_bot.select")
                    : i18nKey("bots.update_bot.title", { name: botState.current.name });
            case "remove":
                return i18nKey("bots.update_bot.remove");
        }
    });
</script>

<ModalContent {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable resourceKey={titleKey}></Translatable>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if step === "choose"}
                {#if !busy && (mode === "update" || mode === "remove")}
                    <ChooseBot ownedOnly onSelect={selectBot} />
                {/if}
                {#if mode === "remove" && busy}
                    <div class="loader">
                        <FancyLoader />
                    </div>
                {/if}
            {:else if step === "edit" && botState.current !== undefined && mode !== "remove"}
                <BotBuilder
                    {nameDirty}
                    {mode}
                    bind:candidate={botState.current}
                    bind:schemaLoaded
                    bind:valid
                    bind:principal />
            {/if}
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="footer">
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                {#if mode !== "remove"}
                    <Button
                        onClick={mode === "update" ? update : register}
                        disabled={!valid || busy}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}>
                        <Translatable
                            resourceKey={mode === "update"
                                ? i18nKey("bots.update_bot.action")
                                : i18nKey("bots.add.action")} />
                    </Button>
                {/if}
            </ButtonGroup>
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .loader {
        width: toRem(80);
        height: toRem(80);
        margin: auto;
    }
</style>
