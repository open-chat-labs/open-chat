<script lang="ts">
    import {
        AvatarSize,
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
    import Avatar from "../Avatar.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        mode: "register" | "update";
    }

    let { onClose, mode = "register" }: Props = $props();

    let valid = $state(false);
    let schemaLoaded = $state(false);
    let busy = $state(false);
    let step: "choose" | "edit" = $state(mode === "update" ? "choose" : "edit");

    let botState = $state({
        original: emptyBotInstance($currentUser.userId),
        current: emptyBotInstance($currentUser.userId),
    });

    let ownerDirty = $derived(botState.original.ownerId !== botState.current.ownerId);
    let nameDirty = $derived(botState.original.name !== botState.current.name);
    let avatarDirty = $derived(botState.original.avatarUrl !== botState.current.avatarUrl);
    let endpointDirty = $derived(botState.original.endpoint !== botState.current.endpoint);
    // let dirty = $derived(ownerDirty || nameDirty || avatarDirty || endpointDirty);

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
            const { id, ownerId, name, avatarUrl, endpoint, definition } = $state.snapshot(
                botState.current,
            );
            client
                .updateRegisteredBot(
                    id,
                    ownerDirty ? ownerId : undefined,
                    nameDirty ? name : undefined,
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
        <Translatable
            resourceKey={mode === "update"
                ? i18nKey("bots.update_bot.title")
                : i18nKey("bots.builder.title")}></Translatable>
    </div>
    <div class="body" slot="body">
        {#if step === "choose"}
            {#if myBots.length === 0}
                <AlertBox>
                    <Translatable resourceKey={i18nKey("bots.update_bot.nobots")}></Translatable>
                </AlertBox>
            {:else}
                <p class="info">
                    <Translatable resourceKey={i18nKey("bots.update_bot.select")}></Translatable>
                </p>
                <div class="bots">
                    {#each myBots as myBot}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div onclick={() => selectBot(myBot)} class="match">
                            <span class="avatar">
                                <Avatar
                                    url={myBot.avatarUrl ?? "/assets/bot_avatar.svg"}
                                    size={AvatarSize.Default} />
                            </span>
                            <div class="details">
                                <h4 class="bot-name">
                                    {myBot.name}
                                </h4>
                                <p title={myBot.definition.description} class="bot-desc">
                                    {myBot.definition.description}
                                </p>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {:else if step === "edit" && botState.current !== undefined}
            <BotBuilder
                {nameDirty}
                {mode}
                candidate={botState.current}
                onUpdate={(b) => (botState.current = b)}
                bind:schemaLoaded
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
                disabled={!valid || busy}
                loading={busy}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
                <Translatable
                    resourceKey={mode === "update"
                        ? i18nKey("bots.update_bot.action")
                        : i18nKey("bots.add.action")} />
            </Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    .bots {
        max-height: 500px;
        overflow: auto;
    }

    .match {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        gap: 12px;
        cursor: pointer;

        @media (hover: hover) {
            &:hover {
                background-color: var(--members-hv);
            }
        }

        @include mobile() {
            padding: $sp3 toRem(10);
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
        align-self: start;
    }

    .details {
        display: flex;
        gap: $sp2;
        flex: 1;
        flex-direction: column;
        @include font(book, normal, fs-100);

        .bot-name {
            @include ellipsis();
        }

        .bot-desc {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
            @include clamp(2);
        }
    }
</style>
