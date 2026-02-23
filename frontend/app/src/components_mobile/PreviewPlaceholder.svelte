<script lang="ts">
    import { Column, ColourVars } from "component-lib";
    import TooltipImageOutline from "svelte-material-icons/TooltipImageOutline.svelte";

    type PreviewKind = "generic_preview" | "none";

    interface Props {
        kind?: PreviewKind;
        me?: boolean;
    }

    let { kind = "none", me = false }: Props = $props();
</script>

{#snippet previewRow(width?: number)}
    {@const w = width ?? 100}
    <div class={`row`} style:width={`${w}%`}>
        <div class="rail"></div>
    </div>
{/snippet}

{#snippet genericPreviewPlaceholder()}
    <div class="generic-preview placeholder" class:me>
        <div
            class="image-preview"
            style:background-color={me ? ColourVars.myChatBubble : ColourVars.background2}>
            <TooltipImageOutline
                size="3rem"
                color={me ? ColourVars.primaryMuted : ColourVars.background1} />
        </div>
        <Column padding={["sm", "md"]} gap="sm" width="fill">
            <div class="title-preview">
                {@render previewRow()}
                {@render previewRow(75)}
            </div>
            <div class="desc-preview">
                {@render previewRow(90)}
                {@render previewRow(60)}
            </div>
            <div class="domain-preview">
                {@render previewRow(25)}
            </div>
        </Column>
    </div>
{/snippet}

{#if kind === "generic_preview"}
    {@render genericPreviewPlaceholder()}
{/if}

<style lang="scss">
    .generic-preview.placeholder {
        width: 78vw; // Max width of the message bubble

        &.me {
            background-color: var(--primary-muted);
        }

        &:not(.me) {
            background-color: var(--background-1);
        }

        .row {
            height: 0.75rem;
            margin: 0.5rem 0;
            position: relative;
            border-radius: var(--rad-lg);
            overflow: hidden;

            .rail {
                width: 72vw;
                height: 100%;
                position: absolute;
                left: 0;
                top: 0;
            }

            .rail:after {
                content: "";
                display: block;
                height: 100%;
                width: 12rem;
                top: 0;
                position: absolute;

                background: rgba(255, 255, 255, 0);
                background: linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0) 0%,
                    rgba(255, 255, 255, 0.2) 50%,
                    rgba(255, 255, 255, 0) 100%
                );

                animation: move-to-right 2s ease-out infinite;
            }
        }

        &.me .row {
            background-color: var(--my-chat-bubble);
        }

        &:not(.me) .row {
            background-color: var(--background-2);
        }

        .image-preview {
            height: 10rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .image-preview,
        .title-preview,
        .desc-preview,
        .domain-preview {
            width: 100%;
        }
    }
</style>
