<script lang="ts">
    import {
        routeForChatIdentifier,
        type AccessRules,
        type ChannelIdentifier,
        type GroupChatSummary,
        type OpenChat,
        ChatListScope,
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

    const client = getContext<OpenChat>("client");

    export let group: GroupChatSummary | undefined;
    export let rules: AccessRules | undefined;

    $: chatListScope = client.chatListScope;

    let scope: ChatListScope["kind"] | undefined;

    let state: "idle" | "converting" | "converted" | "error" = "idle";
    let channelId: ChannelIdentifier | undefined;

    function convert() {
        if (group === undefined) return;

        scope = $chatListScope.kind;
        state = "converting";
        client.convertGroupToCommunity(group, rules ?? { enabled: false, text: "" }).then((id) => {
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
    <Overlay dismissible on:close={close}>
        <ModalContent closeIcon on:close={close}>
            <div slot="header">{$_("communities.convert")}</div>
            <div
                class="body convert-to-community"
                class:error={state === "error"}
                class:loading={state === "converting" || state === "converted"}
                slot="body">
                {#if state === "converting"}
                    <div class="spinner">
                        <FancyLoader />
                    </div>
                    <p class="para">{$_("communities.pleaseWait")}</p>
                {:else if state === "idle"}
                    <Markdown inline={false} text={$_("communities.convertInfo")} />
                {:else if state === "converted"}
                    <Congratulations para={$_("communities.converted")} />
                {:else if state === "error"}
                    <div class="error-img" />
                    <p class="para">{$_("communities.errors.convertFailed")}</p>
                {/if}
            </div>
            <div slot="footer">
                <ButtonGroup>
                    {#if state === "converted"}
                        <Button secondary on:click={close}>{$_("close")}</Button>
                        <Button on:click={go}>{$_("communities.goto")}</Button>
                    {:else if state !== "error"}
                        <Button secondary on:click={close}>{$_("cancel")}</Button>
                        <Button
                            disabled={state === "converting"}
                            loading={state === "converting"}
                            on:click={convert}>{$_("communities.convertButton")}</Button>
                    {/if}
                </ButtonGroup>
            </div>
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
