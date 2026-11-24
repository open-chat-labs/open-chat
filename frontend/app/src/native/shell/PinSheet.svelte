<!-- The PIN sheet (native design notes §3.9 PIN sheet; the plan's 13): the client's PIN prompt
     (pinNumberResolverStore, the web's S3 prompt) as a bottom sheet over whatever asked for it, for
     the shell's life. No header label: "Enter your PIN", the chip saying what it confirms when the
     screen that started the transfer said (pinAction: "Send **25 ICP** to Julian"), the dots and
     the keypad (the kit's PinPad). The sixth digit answers the request (PinAnswer, the web
     prompt's); closing it (×, the veil, a drag, Android's back) declines it, and the client gives
     the transfer up. A wrong PIN shows on the screen that started the transfer, as on the web.
     TODO(design): no "I've forgotten my PIN" (the design has none; GAPS.md). -->
<script lang="ts">
    import { pinNumberResolverStore } from "@client";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import PinPad from "@openchat/ui/src/native/PinPad.svelte";
    import { PIN_LENGTH, PinAnswer } from "@src/logic/composer/sendPrompts";
    import type { PinNumberResolver } from "@shared";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay, type Overlays } from "./overlays.svelte";
    import { chipParts, pinAction } from "./pinAction.svelte";

    let { overlays }: { overlays: Overlays } = $props();

    const request = $derived($pinNumberResolverStore);

    // each request answered once, starting with no digits
    let digits = $state("");
    let answering: { request: PinNumberResolver; answer: PinAnswer } | undefined;
    function answerFor(r: PinNumberResolver): PinAnswer {
        if (answering?.request !== r) {
            answering = { request: r, answer: new PinAnswer(r) };
            digits = "";
        }
        return answering.answer;
    }
    $effect.pre(() => {
        if (request !== undefined) answerFor(request);
    });

    // the chip stays while the sheet slides away
    let lastChip = $state(pinAction.chip);
    $effect.pre(() => {
        if (request !== undefined) lastChip = pinAction.chip;
    });
    const parts = $derived(lastChip === undefined ? undefined : chipParts(lastChip));

    let entering: ReturnType<typeof setTimeout> | undefined;
    function complete(pin: string) {
        const r = request;
        if (r === undefined) return;
        // the last dot fills before the sheet goes
        entering = setTimeout(() => answerFor(r).enter(pin), 180);
    }

    function close() {
        clearTimeout(entering);
        if (request !== undefined) answerFor(request).close();
    }

    useOverlay(
        untrack(() => overlays),
        () => request !== undefined,
        close,
    );
</script>

<BottomSheet open={request !== undefined} onClose={close} label={$_("native.walletFlows.enterPin")}>
    <div class="pin">
        <div class="head">
            <span class="title">{$_("native.walletFlows.enterPin")}</span>
            {#if lastChip !== undefined && parts !== undefined}
                <span class="chip">
                    <TokenAvatar
                        size={24}
                        symbol={lastChip.token.symbol}
                        mark={lastChip.token.mark}
                        gradient={lastChip.token.grad}
                        logo={lastChip.token.logo} />
                    <span class="chip-text">{parts[0]}<b>{parts[1]}</b>{parts[2]}</span>
                </span>
            {/if}
        </div>
        {#if request !== undefined}
            <PinPad
                value={digits}
                length={PIN_LENGTH}
                label={$_("native.walletFlows.pin")}
                deleteLabel={$_("native.walletFlows.deleteDigit")}
                onInput={(v) => (digits = v)}
                onComplete={complete} />
        {/if}
    </div>
</BottomSheet>

<style lang="scss">
    .pin {
        display: flex;
        flex-direction: column;
        gap: 26px;
        padding: 18px var(--space-24) calc(var(--safe-bottom) + var(--space-24));
    }

    .head {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        text-align: center;
    }

    .title {
        font: var(--weight-bold) text-size(19px) / 1.2 var(--font-sans);
        color: var(--ink);
    }

    .chip {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        max-width: 100%;
        height: 34px;
        padding: 0 var(--space-12) 0 5px;
        border-radius: 17px;
        background: var(--overlay-1);
    }

    .chip-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-sans);
        color: var(--ink-2);

        b {
            color: var(--ink);
        }
    }
</style>
