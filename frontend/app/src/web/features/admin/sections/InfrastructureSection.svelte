<!-- Infrastructure: group and community upgrade concurrency, creating a MultiUser canister, and
     pausing this session's chat polling (the old console's "event loop", which only ever stopped
     and started this client's poller). Each a settings card with its last outcome. -->
<script lang="ts">
    import type { OpenChat, ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import SettingsCard from "@openchat/ui/src/lib/components/SettingsCard.svelte";
    import TextInput from "@openchat/ui/src/lib/components/TextInput.svelte";
    import { principalProblem, wholeNumberProblem } from "@src/logic/admin/fieldChecks";
    import { getContext, onMount } from "svelte";
    import { sessionPolling, type AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
        translate: (key: ResourceKey) => string;
    }

    let { admin, translate }: Props = $props();

    const client = getContext<OpenChat>("client");
    const ops = $derived(admin.ops);
    onMount(() => admin.loadOperatorFunctions());

    const out = (form: string, busy: boolean) => admin.cardOutcome(form, busy, translate);
</script>

<SettingsCard
    title="Group upgrade concurrency"
    help="How many group canisters are upgraded in parallel."
    icon="layers"
    outcome={out("groupConcurrency", ops.busy.has("groupUpgradeConcurrency"))}>
    <TextInput
        value={ops.groupUpgradeConcurrency}
        placeholder="Group upgrade concurrency"
        inputmode="numeric"
        mono
        error={wholeNumberProblem(ops.groupUpgradeConcurrency)}
        onInput={(v) => (ops.groupUpgradeConcurrency = v)} />
    {#snippet actions()}
        <Button
            label="Apply"
            busy={ops.busy.has("groupUpgradeConcurrency")}
            disabled={ops.busy.has("groupUpgradeConcurrency") ||
                ops.groupUpgradeConcurrencyInvalid ||
                wholeNumberProblem(ops.groupUpgradeConcurrency) !== undefined}
            onClick={() =>
                void admin.outcomes.run("groupConcurrency", () =>
                    ops.setGroupUpgradeConcurrency(),
                )} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Community upgrade concurrency"
    help="How many community canisters are upgraded in parallel."
    icon="layers"
    outcome={out("communityConcurrency", ops.busy.has("communityUpgradeConcurrency"))}>
    <TextInput
        value={ops.communityUpgradeConcurrency}
        placeholder="Community upgrade concurrency"
        inputmode="numeric"
        mono
        error={wholeNumberProblem(ops.communityUpgradeConcurrency)}
        onInput={(v) => (ops.communityUpgradeConcurrency = v)} />
    {#snippet actions()}
        <Button
            label="Apply"
            busy={ops.busy.has("communityUpgradeConcurrency")}
            disabled={ops.busy.has("communityUpgradeConcurrency") ||
                ops.communityUpgradeConcurrencyInvalid ||
                wholeNumberProblem(ops.communityUpgradeConcurrency) !== undefined}
            onClick={() =>
                void admin.outcomes.run("communityConcurrency", () =>
                    ops.setCommunityUpgradeConcurrency(),
                )} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Create MultiUser canister"
    help="Creates a MultiUser canister under a LocalUserIndex."
    icon="plus"
    outcome={out("multiUser", ops.busy.has("multiUserCanister"))}>
    <TextInput
        value={ops.multiUserCanisterLocalUserIndex}
        placeholder="LocalUserIndex canister id"
        mono
        paste
        valid={ops.multiUserCanisterLocalUserIndex.trim() !== "" &&
            !ops.multiUserCanisterLocalUserIndexInvalid}
        error={principalProblem(ops.multiUserCanisterLocalUserIndex)}
        onInput={(v) => (ops.multiUserCanisterLocalUserIndex = v)} />
    {#snippet actions()}
        <Button
            label="Create"
            busy={ops.busy.has("multiUserCanister")}
            disabled={ops.busy.has("multiUserCanister") ||
                ops.multiUserCanisterLocalUserIndexInvalid}
            onClick={() =>
                void admin.outcomes.run("multiUser", () => ops.createMultiUserCanister())} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Chat polling in this session"
    help="Pauses or resumes this browser session’s polling for chat updates, for debugging. Nobody else is affected."
    icon="refresh"
    tag={sessionPolling.paused ? "Paused" : "Running"}
    tagTone={sessionPolling.paused ? "warning" : "success"}>
    {#snippet actions()}
        {#if !sessionPolling.paused}
            <Button
                label="Pause"
                variant="secondary"
                onClick={() => {
                    client.pauseEventLoop();
                    sessionPolling.paused = true;
                }} />
        {:else}
            <Button
                label="Resume"
                onClick={() => {
                    client.resumeEventLoop();
                    sessionPolling.paused = false;
                }} />
        {/if}
    {/snippet}
</SettingsCard>
