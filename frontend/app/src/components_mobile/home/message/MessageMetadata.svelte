<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        ChatFootnote,
        ColourVars,
        Container,
        type ColourVarKeys,
        type Padding,
        Row,
    } from "component-lib";
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
        fill: boolean; // TODO deprecate this!
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
        fill,
        accepted,
        chatType,
        readByThem,
        expiresAt,
        percentageExpired,
        pinned,
    }: Props = $props();

    let textColorVar = $derived(
        fill ? ColourVars.textPrimary : me ? ColourVars.primaryLight : ColourVars.textSecondary,
    );
    let textColorTxt = $derived<ColourVarKeys>(
        fill ? "textPrimary" : me ? "primaryLight" : "textSecondary",
    );
    let padding = $derived<Padding>(
        fill ? (me ? "xs" : ["sm", "md"]) : ["zero", "sm", "xs", "zero"],
    );
</script>

{#snippet check(checked: boolean)}
    <div class="bubble_check" class:fill>
        <Container
            borderRadius="circle"
            borderColour={fill ? "transparent" : ColourVars.primaryLight}
            borderWidth="thin"
            backgroundColor={fill
                ? "transparent"
                : checked
                  ? ColourVars.primaryLight
                  : ColourVars.myChatBubble}>
            <Check
                size={fill ? "0.85rem" : "0.75rem"}
                color={fill
                    ? checked
                        ? ColourVars.textPrimary
                        : ColourVars.textSecondary
                    : checked
                      ? ColourVars.myChatBubble
                      : ColourVars.primaryLight} />
        </Container>
    </div>
{/snippet}

<Row
    supplementalClass={`message_metadata ${fill ? "fill" : ""}`}
    gap={fill ? "zero" : "xxs"}
    {padding}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"end"}
    width={"hug"}>
    <Row supplementalClass="message_metadata_text" gap="xs" width="hug">
        {#if edited}
            <!-- TODO would a pencil icon here be enough to indicate edited content -->
            <ChatFootnote colour={textColorTxt}>
                <Translatable resourceKey={i18nKey("edited")} />
            </ChatFootnote>
            <ChatFootnote colour={textColorTxt}>/</ChatFootnote>
        {/if}
        <ChatFootnote colour={textColorTxt}>
            {client.toShortTimeString(new Date(time))}
        </ChatFootnote>
    </Row>
    <Row supplementalClass="message_metadata_icons" width="hug">
        {#if failed}
            <AlertCircleOutline color={textColorVar} />
        {/if}
        {#if deleted}
            <DeletedIcon color={textColorVar} />
            {#if undeleting}
                <div class="confirming"></div>
            {/if}
        {/if}
        {#if !bot && !deleted}
            {#if me}
                {@render check(accepted)}
                {#if chatType === "direct_chat"}
                    {@render check(readByThem)}
                {/if}
            {:else if !accepted}
                <div class="confirming"></div>
            {/if}
            {#if expiresAt !== undefined}
                <DisappearsAt {me} {percentageExpired} {expiresAt} />
            {/if}
        {/if}
        {#if pinned}
            <Pin color={textColorVar} />
        {/if}
    </Row>
</Row>

<style lang="scss">
    :global {
        .container.message_metadata {
            position: absolute;
            pointer-events: none;
            bottom: 0;
            right: 0;

            &.fill {
                position: absolute;
                right: 0;
                bottom: 0;

                .message_metadata_text {
                    text-shadow: 0 0 0.125rem var(--backdrop);
                }

                .bubble_check path {
                    filter: drop-shadow(0 0 0.125rem var(--background-0));
                }
            }
        }

        .message_metadata_icons > :not(:first-child) {
            z-index: 1;

            &:not(.fill) {
                margin-left: -0.375rem;
            }

            &.fill {
                margin-left: -0.7rem;
            }
        }
    }

    .confirming {
        width: 1.1rem;
        height: 0.8rem;
        @include loading-spinner(0.8rem, 0.3rem, "#ffffff", "/assets/plain-spinner.svg", 1.5s);
    }

    .bubble_check {
        border-radius: var(--rad-circle);
        border-width: var(--bw-thin);
        border-style: solid;

        &.fill {
            border-color: transparent;
        }

        &:not(.fill) {
            border-color: var(--my-chat-bubble);
        }
    }
</style>
