<!-- The chat's (and its community's) rules, when sending needs them accepted first: the client asks
     through captureRulesAcceptanceStore and waits (logic/composer/sendPrompts, which the web's
     RulesDialog answers too). Accept sends the message on; Cancel, or closing the sheet, gives the
     send up, and the composer keeps the draft with Send back. The selected chat's conversation
     shows it; another chat declines it, as on the web. The keyboard goes down as it opens, so it
     doesn't cover the buttons.
     TODO(design): the design has no rules sheet; ours, a bottom sheet with the old words. -->
<script lang="ts">
    import {
        captureRulesAcceptanceStore,
        pinNumberResolverStore,
        selectedChatIdStore,
        selectedChatRulesStore,
        selectedCommunityRulesStore,
        type OpenChat,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { declineOnChatChange, waitingPrompt } from "@src/logic/composer/sendPrompts";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { useOverlay, type Overlays } from "../../shell/overlays.svelte";

    type Props = {
        /** This screen's chat is the selected one, whose rules the client asks about. */
        shown: boolean;
        overlays: Overlays;
    };

    let { shown, overlays }: Props = $props();

    const client = getContext<OpenChat>("client");

    const prompt = $derived(waitingPrompt($captureRulesAcceptanceStore, $pinNumberResolverStore));
    const request = $derived(shown && prompt.kind === "rules" ? prompt.request : undefined);

    // the last rules shown stay while the sheet slides away
    let lastRules = "";
    const rules = $derived.by(() => {
        if (request !== undefined) {
            lastRules = client.combineRulesText($selectedChatRulesStore, $selectedCommunityRulesStore);
        }
        return lastRules;
    });

    // answered once: the client clears the request as it's answered
    function answer(accepted: boolean) {
        request?.resolve(accepted);
    }

    // another chat declines it
    $effect(() => {
        const waiting = request;
        if (waiting === undefined) return;
        return declineOnChatChange(selectedChatIdStore, () => waiting.resolve(false));
    });

    // the composer's keyboard down, so the sheet's buttons show
    $effect(() => {
        if (request === undefined) return;
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) focused.blur();
    });

    useOverlay(
        overlays,
        () => request !== undefined,
        () => answer(false),
    );
</script>

<BottomSheet open={request !== undefined} onClose={() => answer(false)} title={$_("rules.acceptTitle")}>
    <div class="rules">
        <Markdown text={rules} inline={false} />
    </div>
    <div class="foot">
        <Button
            label={$_("cancel")}
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => answer(false)} />
        <Button label={$_("rules.accept")} size="lg" fullWidth onClick={() => answer(true)} />
    </div>
</BottomSheet>

<style lang="scss">
    .rules {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: var(--space-4) var(--space-16) var(--space-16);
        font: var(--weight-regular) text-size(15px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        overflow-wrap: anywhere;
    }

    .foot {
        flex: none;
        display: flex;
        gap: var(--space-10);
        padding: var(--space-8) var(--space-16) calc(var(--safe-bottom) + var(--space-16));
    }
</style>
