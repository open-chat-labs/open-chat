<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { ChatFootnote, ColourVars, Container } from "component-lib";
    import type { ChatType, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import DeletedIcon from "svelte-material-icons/DeleteOutline.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import Translatable from "../../Translatable.svelte";
    import DisappearsAt from "../DisappearsAt.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        time: number;
        edited: boolean;
        failed: boolean;
        deleted: boolean;
        undeleting: boolean;
        bot: boolean;
        me: boolean;
        fill: boolean;
        accepted: boolean;
        chatType: ChatType;
        readByThem: boolean;
        expiresAt: number | undefined;
        percentageExpired: number;
        pinned: boolean;
    }

    let {
        edited,
        time,
        failed,
        deleted,
        undeleting,
        bot,
        me,
        accepted,
        chatType,
        readByThem,
        expiresAt,
        percentageExpired,
        pinned,
        fill,
    }: Props = $props();
</script>

{#snippet check(fill: boolean = false)}
    <div class="bubble_check" class:fill>
        <Container
            borderRadius="circle"
            borderColour={ColourVars.primaryLight}
            borderWidth="thin"
            backgroundColor={fill ? ColourVars.primaryLight : ColourVars.myChatBubble}>
            <Check
                size="0.75rem"
                color={fill ? ColourVars.myChatBubble : ColourVars.primaryLight} />
        </Container>
    </div>
{/snippet}

<Container
    supplementalClass={`message-metadata ${fill ? "fill" : ""}`}
    gap={"xs"}
    padding={["zero", "zero", "xs", "zero"]}
    crossAxisAlignment={"center"}
    crossAxisSelfAlignment={"end"}
    width={"hug"}>
    {#if edited}
        <ChatFootnote>(<Translatable resourceKey={i18nKey("edited")} />)</ChatFootnote>
    {/if}
    <ChatFootnote>
        {client.toShortTimeString(new Date(time))}
    </ChatFootnote>
    <Container supplementalClass={"message-metadata-icons"}>
        {#if failed}
            <AlertCircleOutline />
        {/if}
        {#if deleted}
            <DeletedIcon />
            {#if undeleting}
                <div class="confirming"></div>
            {/if}
        {/if}
        {#if !bot}
            {#if me}
                {#if accepted}
                    {@render check(true)}
                {:else}
                    <div class="confirming"></div>
                {/if}
                {#if chatType === "direct_chat"}
                    {#if readByThem}
                        {@render check(true)}
                    {:else}
                        {@render check(false)}
                    {/if}
                {/if}
            {:else if !accepted}
                <div class="confirming"></div>
            {/if}
            {#if expiresAt !== undefined}
                <DisappearsAt {me} {percentageExpired} {expiresAt} />
            {/if}
        {/if}
        {#if pinned}
            <Pin />
        {/if}
    </Container>
</Container>

<style lang="scss">
    :global(.message-metadata.fill) {
        position: absolute;
        padding: var(--sp-sm) !important;
        bottom: 0;
        right: 0;
        background-color: rgba(0, 0, 0, 0.3) !important;
        color: #fff;
        border-radius: var(--rad-xl) 0 0 0 !important;
    }

    :global(.message-metadata-icons > :not(:first-child)) {
        margin-left: -6px;
        z-index: 1;
    }

    .confirming {
        width: 1.1rem;
        height: 0.8rem;
        @include loading-spinner(0.8rem, 0.3rem, "#ffffff", "/assets/plain-spinner.svg", 1.5s);
    }

    .bubble_check {
        border-radius: var(--rad-circle);
        border: var(--bw-thin) solid var(--my-chat-bubble);
    }
</style>
