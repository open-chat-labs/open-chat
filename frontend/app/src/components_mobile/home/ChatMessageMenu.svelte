<script lang="ts">
    import { quickReactions } from "@src/stores/quickReactions";
    import { Column, Row, IconButton, ColourVars, type Padding } from "component-lib";
    import { _ } from "svelte-i18n";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import EmoticonOutline from "svelte-material-icons/EmoticonOutline.svelte";
    import ChatMessageOptions, { type Props as OptionProps } from "./ChatMessageOptions.svelte";

    interface Props extends OptionProps {
        deleted: boolean;
        canReact: boolean;
        selectQuickReaction: (unicode: string) => void;
        showEmojiPicker: () => void;
        onOpenSheetMenu: () => void;
    }

    let props: Props = $props();
    let { deleted, failed, me, canReact, selectQuickReaction, showEmojiPicker, onOpenSheetMenu } =
        props;

    const padding: Padding = ["sm", "sm"];
</script>

<Column gap="sm" overflow="visible" crossAxisAlignment={me ? "end" : "start"}>
    {#if canReact && !deleted && !failed}
        <Row
            width="hug"
            maxWidth="80vw"
            backgroundColor={ColourVars.background1}
            supplementalClass={`message_bubble_menu ${me ? "me" : ""}`}>
            <!-- Reactons -->
            <Row
                gap="xs"
                width="fill"
                padding={["xs", "xxxl", "xs", "md"]}
                minHeight="3.75rem"
                crossAxisAlignment="center">
                {#each $quickReactions as reaction}
                    <IconButton {padding} onclick={() => selectQuickReaction(reaction)}>
                        {#snippet icon()}
                            <span class="quick-reaction">
                                {reaction}
                            </span>
                        {/snippet}
                    </IconButton>
                {/each}
            </Row>

            <!-- View emoji picker btn -->
            <div class="menu-btn">
                <IconButton {padding} onclick={showEmojiPicker}>
                    {#snippet icon(color)}
                        <EmoticonOutline {color} />
                    {/snippet}
                </IconButton>
            </div>
        </Row>
    {/if}

    <!-- Message options -->
    <!-- TODO has almost same attrs as the row above, reduce duplication -->
    <Row
        width="hug"
        maxWidth="70vw"
        backgroundColor={ColourVars.background1}
        supplementalClass={`message_bubble_menu second ${me ? "me" : ""}`}>
        <!-- Message options -->
        <Row
            gap="sm"
            width="fill"
            padding={["xs", "xxxl", "xs", "md"]}
            minHeight="3.75rem"
            crossAxisAlignment="center">
            <ChatMessageOptions {...props} />
        </Row>

        <!-- Open more options -->
        <div class="menu-btn">
            <IconButton {padding} onclick={onOpenSheetMenu}>
                {#snippet icon(color)}
                    <DotsVertical {color} />
                {/snippet}
            </IconButton>
        </div>
    </Row>
</Column>

<style lang="scss">
    .quick-reaction {
        font-size: 1.5rem;
    }
    .menu-btn {
        right: 0;
        position: absolute;
        padding: 0 var(--sp-xs) 0 var(--sp-md);
        background: linear-gradient(
            90deg,
            rgba(28, 29, 38, 0) 0%,
            rgba(28, 29, 38, 1) 25%,
            rgba(28, 29, 38, 1) 100%
        ) !important;

        top: 50%;
        transform: translateY(-50%);
    }

    :global {
        .message_bubble_menu {
            box-shadow: var(--menu-sh);

            &.me {
                border-radius: var(--rad-huge) var(--rad-sm) var(--rad-sm) var(--rad-huge) !important;

                &.second {
                    border-bottom-right-radius: var(--rad-huge) !important;
                }
            }

            &:not(.me) {
                border-radius: var(--rad-md) var(--rad-huge) var(--rad-huge) var(--rad-sm) !important;
            }

            &.second:not(.me) {
                border-bottom-left-radius: var(--rad-huge) !important;
            }
        }
    }
</style>
