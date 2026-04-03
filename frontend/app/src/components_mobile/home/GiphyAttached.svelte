<script lang="ts">
    import { ColourVars, Column, IconButton, Row } from "component-lib";
    import { type GiphyContent } from "openchat-client";
    import Close from "svelte-material-icons/Close.svelte";
    import { rtlStore } from "../../stores/rtl";
    // import { lowBandwidth } from "../../stores/settings";

    interface Props {
        content: GiphyContent;
        onRemove?: () => void;
    }

    let { content, onRemove }: Props = $props();
    // let hidden = $derived($lowBandwidth);
</script>

<Row padding={"xs"}>
    <Column
        supplementalClass="gif_attachment_wrapper"
        width="fill"
        gap="xs"
        padding={"xs"}
        borderRadius={"lg"}
        crossAxisAlignment={"center"}
        backgroundColor={ColourVars.background0}>
        <div class="gif_preview" class:rtl={$rtlStore}>
            <img class={"gif"} src={content.mobile.url} alt={content.caption ?? content.title} />
            <div class="attribution">
                <img src="/assets/klipy_logo.svg" alt="Powered by KLIPY" />
            </div>
        </div>
        <!-- <Column
            width="hug"
            padding={["sm", "md"]}
            borderRadius="circle"
            background={ColourVars.background2}>
            <BodySmall colour={"textSecondary"}>
                {content.title}
            </BodySmall>
        </Column> -->
        <div class="close" class:rtl={$rtlStore}>
            <IconButton size="sm" mode={"dark"} onclick={onRemove}>
                {#snippet icon()}
                    <Close color={ColourVars.textPrimary} />
                {/snippet}
            </IconButton>
        </div>
    </Column>
</Row>

<style lang="scss">
    :global {
        .gif_attachment_wrapper {
            position: relative;

            .gif_preview svg {
                position: absolute;
                bottom: var(--sp-xxs);

                path {
                    filter: drop-shadow(0 0 0.125rem var(--backdrop));
                }
            }

            .gif_preview:not(.rtl) svg {
                left: var(--sp-xxs);
            }

            .gif_preview.rtl svg {
                right: var(--sp-xxs);
            }
        }
    }

    .gif_preview {
        position: relative;

        .attribution {
            position: absolute;
            bottom: 0;
            left: 0;

            img {
                width: 4rem;
            }
        }
    }

    .gif {
        display: flex;
        max-width: 14rem;
        max-height: 14rem;
        overflow: hidden;
        border-radius: var(--rad-md);
    }

    .close {
        position: absolute;
        top: var(--sp-xs);
        right: var(--sp-xs);

        &:not(.rtl) {
            right: var(--sp-xs);
        }

        &.rtl {
            left: var(--sp-xs);
        }
    }
</style>
