<script lang="ts">
    import {
        routeForChatIdentifier,
        type ChannelIdentifier,
        type GroupChatSummary,
        type OpenChat,
        type ChatListScope,
        defaultChatRules,
        chatListScopeStore as chatListScope,
    } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Markdown from "../Markdown.svelte";
    import Button from "../../Button.svelte";
    import { _ } from "svelte-i18n";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Congratulations from "../upgrade/Congratulations.svelte";
    import { getContext } from "svelte";
    import page from "page";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        group: GroupChatSummary | undefined;
    }

    let { group = $bindable() }: Props = $props();

    let scope: ChatListScope["kind"] | undefined;

    let state: "idle" | "converting" | "converted" | "error" = $state("idle");
    let channelId: ChannelIdentifier | undefined;

    function convert() {
        if (group === undefined) return;

        scope = $chatListScope.kind;
        state = "converting";
        client.convertGroupToCommunity(group, defaultChatRules("community")).then((id) => {
            state = id ? "converted" : "error";
            channelId = id;
        });
    }

    function go() {
        if (channelId !== undefined) {
            close();
            page(routeForChatIdentifier(scope ?? $chatListScope.kind, channelId));
        }
    }

    function close() {
        group = undefined;
        state = "idle";
    }
</script>

{#if group !== undefined}
    <Overlay dismissible onClose={close}>
        <ModalContent closeIcon onClose={close}>
            {#snippet header()}
                <Translatable resourceKey={i18nKey("communities.convert")} />
            {/snippet}
            {#snippet body()}
                <div
                    class="body convert-to-community"
                    class:error={state === "error"}
                    class:loading={state === "converting" || state === "converted"}>
                    {#if state === "converting"}
                        <div class="spinner">
                            <FancyLoader />
                        </div>
                        <p class="para">
                            <Translatable resourceKey={i18nKey("communities.pleaseWait")} />
                        </p>
                    {:else if state === "idle"}
                        <Markdown inline={false} text={$_("communities.convertInfo")} />
                    {:else if state === "converted"}
                        <Congratulations para={i18nKey("communities.converted")} />
                    {:else if state === "error"}
                        <div class="error-img"></div>
                        <p class="para">
                            <Translatable
                                resourceKey={i18nKey("communities.errors.convertFailed")} />
                        </p>
                    {/if}
                </div>
            {/snippet}
            {#snippet footer()}
                <ButtonGroup>
                    {#if state === "converted"}
                        <Button secondary on:click={close}
                            ><Translatable resourceKey={i18nKey("close")} /></Button>
                        <Button on:click={go}
                            ><Translatable resourceKey={i18nKey("communities.goto")} /></Button>
                    {:else if state !== "error"}
                        <Button secondary on:click={close}
                            ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                        <Button
                            disabled={state === "converting"}
                            loading={state === "converting"}
                            on:click={convert}
                            ><Translatable
                                resourceKey={i18nKey("communities.convertButton")} /></Button>
                    {/if}
                </ButtonGroup>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    :global(.convert-to-community .markdown-wrapper ul) {
        @include bullet_list();
        @include font(book, normal, fs-90);
        color: var(--txt-light);
    }

    .body {
        min-height: 300px;

        &.loading,
        &.error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
    }
    .spinner {
        width: 150px;
        margin: 30px auto;
    }

    .error-img {
        background-image: url("/assets/dead-bot.svg");
        background-repeat: no-repeat;
        width: 150px;
        height: 150px;
        margin: 30px auto;
    }

    .para {
        margin-bottom: $sp3;
    }
</style>
