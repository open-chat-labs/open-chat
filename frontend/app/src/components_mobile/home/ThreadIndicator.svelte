<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, ColourVars, Container, CountBadge } from "component-lib";
    import { numberOfThreadsStore, type UnreadCounts } from "openchat-client";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import MessageText from "svelte-material-icons/MessageTextOutline.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        unread: UnreadCounts;
        onClick: () => void;
    }

    let { unread, onClick }: Props = $props();
    let muted = $derived(!unread.mentions && unread.unmuted <= 0);
    let count = $derived(muted ? unread.muted : unread.unmuted);
</script>

{#if $numberOfThreadsStore > 0}
    <Container
        {onClick}
        crossAxisAlignment={"center"}
        mainAxisAlignment={"spaceBetween"}
        gap={"sm"}
        padding={["sm", "lg"]}>
        <div class="icon">
            <MessageText size={"1.5rem"} color={ColourVars.textSecondary} />
        </div>
        <Body colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("Thread replies")} />
        </Body>
        <ChevronRight color={ColourVars.textSecondary} />
        {#if count > 0}
            <CountBadge {muted}>
                {count}
            </CountBadge>
        {/if}
    </Container>
{/if}

<style lang="scss">
    .icon {
        padding: 0 var(--sp-lg);
        display: flex;
        justify-content: center;
    }
</style>
