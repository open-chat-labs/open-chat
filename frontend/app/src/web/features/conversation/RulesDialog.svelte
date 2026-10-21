<!-- The chat's (and its community's) rules, when sending needs them accepted first: the client asks
     through captureRulesAcceptanceStore and waits, as the old UI's AcceptRulesModal answered it, and
     AppScreen shows this with that request's answer. Accept sends on; Reject, or closing, gives the
     send up (the composer keeps the draft). -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { _ } from "svelte-i18n";

    let { rules, answer }: { rules: string; answer: (accepted: boolean) => void } = $props();
</script>

<!-- TODO(design): no rules dialog in the design; the old modal's words and choices -->
<DialogShell title={$_("rules.acceptTitle")} onClose={() => answer(false)}>
    <div class="rules">
        <Markdown text={rules} inline={false} />
    </div>
    <div class="actions">
        <Button label={$_("rules.reject")} variant="secondary" onClick={() => answer(false)} />
        <Button label={$_("rules.accept")} onClick={() => answer(true)} />
    </div>
</DialogShell>

<style>
    .rules {
        max-height: 50vh;
        overflow-y: auto;
        font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-10);
        margin-block-start: var(--space-16);
    }
</style>
