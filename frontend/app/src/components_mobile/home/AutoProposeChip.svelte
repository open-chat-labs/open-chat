<script lang="ts">
    // The auto-propose suggestion chip, rendered under a message bubble alongside
    // reactions/tips when the message matched a registered action's trigger keywords
    // (see utils/autoPropose.ts). Tap runs the existing propose flow; the X dismisses
    // the suggestion, and long-pressing the X mutes suggestions for the whole chat.
    import type { ResourceKey } from "@client";
    import { i18nKey } from "@src/i18n/i18n";
    import { ChatFootnote, ColourVars, Container, Row, Spinner } from "component-lib";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import Robot from "svelte-material-icons/RobotOutline.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        me: boolean;
        // The matched action's card title.
        title: string;
        offset: boolean;
        // The propose flow is running: show progress and swallow duplicate taps.
        busy?: boolean;
        // Another suggestion for this message is active. Keep this chip visible but inert.
        disabled?: boolean;
        busyResourceKey: ResourceKey;
        onPropose: () => void;
        onDismiss: () => void;
        onMute: () => void;
    }

    let {
        me,
        title,
        offset,
        busy = false,
        disabled = false,
        busyResourceKey,
        onPropose,
        onDismiss,
        onMute,
    }: Props = $props();

    const LONG_PRESS_MS = 600;
    let pressTimer: number | undefined = undefined;
    let longPressed = false;

    function pressStart() {
        longPressed = false;
        pressTimer = window.setTimeout(() => {
            longPressed = true;
            pressTimer = undefined;
            onMute();
        }, LONG_PRESS_MS);
    }

    function pressEnd() {
        if (pressTimer !== undefined) {
            window.clearTimeout(pressTimer);
            pressTimer = undefined;
        }
    }

    function dismissClicked(e: MouseEvent) {
        e.stopPropagation();
        if (!longPressed) {
            onDismiss();
        }
        longPressed = false;
    }
</script>

<Container
    supplementalClass={offset ? "auto-propose-offset-top" : ""}
    gap={"xxs"}
    padding={["zero", "md"]}
    width={"hug"}
    height={"hug"}
    mainAxisAlignment={me ? "end" : "start"}
    crossAxisAlignment={"center"}
>
    <Row
        supplementalClass={`auto-propose-chip${busy ? " busy" : ""}${disabled ? " disabled" : ""}`}
        onClick={() => !busy && !disabled && onPropose()}
        width={"hug"}
        height={"hug"}
        padding={["xxs", "sm"]}
        background={ColourVars.surface2}
        crossAxisAlignment={"center"}
        mainAxisAlignment={"center"}
        gap={"xs"}
        borderRadius={"circle"}
        borderWidth={"thick"}
        borderColour={ColourVars.surface0}
    >
        {#if busy}
            <Spinner
                size={"1rem"}
                foregroundColour={"var(--primary)"}
                backgroundColour={"var(--text-on-disabled-surface)"}
            />
        {:else}
            <Robot size={"1rem"} color={"var(--primary)"} />
        {/if}
        <ChatFootnote>
            {#if busy}
                <Translatable resourceKey={busyResourceKey} />
            {:else}
                <Translatable resourceKey={i18nKey("aiApps.autoPropose.suggestion", { title })} />
            {/if}
        </ChatFootnote>
        <button
            type="button"
            class="dismiss"
            aria-label={$_("aiApps.autoPropose.mute")}
            disabled={busy || disabled}
            onpointerdown={pressStart}
            onpointerup={pressEnd}
            onpointerleave={pressEnd}
            onclick={dismissClicked}
        >
            <Close size={"1rem"} color={"var(--text-secondary)"} />
        </button>
    </Row>
</Container>

<style lang="scss">
    :global(.auto-propose-offset-top) {
        top: -0.5rem;
    }

    :global(.auto-propose-chip.busy) {
        cursor: default;
    }

    :global(.auto-propose-chip.disabled:not(.busy)) {
        cursor: default;
        opacity: 0.65;
    }

    .dismiss {
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
    }
</style>
