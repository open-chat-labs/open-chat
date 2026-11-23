<!-- Join for a preview (N8b, native plan 12 "Preview and join"): under the join bar's note, and at the
     foot of a community's preview. What it joins is logic/join's previewBar; with rules to agree to
     or requirements, the client answers with them and the join sheet opens over it on them
     (JoinSheet: the rules, then the requirements). "You joined …"
     or why it didn't go through comes as a toast. -->
<script lang="ts">
    import { type OpenChat } from "@client";
    import { interpolateNewUi } from "@i18n/i18n";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import { beginJoin, isJoining, type JoinTarget } from "@src/logic/join/joinFlow.svelte";
    import type { PreviewBar } from "@src/logic/join/previewBar";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { Overlays } from "../../shell/overlays.svelte";
    import { joinStepToast, type JoinButtonView } from "./joinBar.adapter";
    import type { JoinSheetStart } from "./joinSheet.adapter";
    import JoinSheet from "./JoinSheet.svelte";

    interface Props {
        bar: PreviewBar;
        view: JoinButtonView;
        overlays: Overlays;
        toast: (message: string) => void;
    }

    let { bar, view, overlays, toast }: Props = $props();

    const client = getContext<OpenChat>("client");

    // the rules or requirements the client answered Join with; a closed sheet stays to slide away
    let sheet = $state<{
        id: number;
        target: JoinTarget;
        start: JoinSheetStart;
        name: string;
    }>();

    let mounted = true;
    onDestroy(() => (mounted = false));

    async function join() {
        const { target, name } = bar;
        // the rules can take a moment to read: nothing is joined or shown once the bar has gone
        const step = await beginJoin(client, target, () => mounted);
        if (step.kind === "agree_to_rules" || step.kind === "evaluate_gates") {
            const start: JoinSheetStart =
                step.kind === "agree_to_rules"
                    ? { kind: "rules", rules: step.rules }
                    : { kind: "gates", gates: step.gates };
            sheet = { id: (sheet?.id ?? 0) + 1, target, start, name };
            return;
        }
        const message = joinStepToast(step, name);
        if (message !== undefined) toast(interpolateNewUi($_, message));
    }
</script>

<Button
    label={interpolateNewUi($_, view.label)}
    icon={view.icon}
    size="lg"
    fullWidth
    disabled={view.disabled}
    busy={isJoining(bar.target)}
    onClick={join} />

{#if sheet !== undefined}
    {#key sheet.id}
        <JoinSheet join={sheet} {overlays} {toast} />
    {/key}
{/if}
