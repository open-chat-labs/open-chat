<!-- Join for a preview (N8b, native plan 12 "Preview and join"): under the join bar's note, and at the
     foot of a community's preview. What it joins is logic/join's previewBar; with requirements, the
     client answers with them and the requirements sheet opens over it (JoinSheet). "You joined …"
     or why it didn't go through comes as a toast. -->
<script lang="ts">
    import { type EnhancedAccessGate, type OpenChat } from "@client";
    import { interpolate } from "@i18n/i18n";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import { isJoining, startJoin, type JoinTarget } from "@src/logic/join/joinFlow.svelte";
    import type { PreviewBar } from "@src/logic/join/previewBar";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { Overlays } from "../../shell/overlays.svelte";
    import { joinStepToast, type JoinButtonView } from "./joinBar.adapter";
    import JoinSheet from "./JoinSheet.svelte";

    interface Props {
        bar: PreviewBar;
        view: JoinButtonView;
        overlays: Overlays;
        toast: (message: string) => void;
    }

    let { bar, view, overlays, toast }: Props = $props();

    const client = getContext<OpenChat>("client");

    // the requirements the client answered Join with; a closed sheet stays to slide away
    let sheet = $state<{
        id: number;
        target: JoinTarget;
        gates: EnhancedAccessGate[];
        name: string;
    }>();

    async function join() {
        const { target, name } = bar;
        const step = await startJoin(client, target);
        if (step.kind === "evaluate_gates") {
            sheet = { id: (sheet?.id ?? 0) + 1, target, gates: step.gates, name };
            return;
        }
        const message = joinStepToast(step, name);
        if (message !== undefined) toast(interpolate($_, message));
    }
</script>

<Button
    label={interpolate($_, view.label)}
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
