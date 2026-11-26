<!-- Integrations: native call push (a single switch on its card's title line, applied as it's
     flipped), the Alchemy key for Solana RPC (Set, or Unset with its own button so a second click
     on Set can't unset it), the MiniApp service principal, and a bridge bot per platform. Each a
     settings card with its last outcome. -->
<script lang="ts">
    import { BRIDGE_PLATFORM_NAMES, type ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import SettingsCard from "@openchat/ui/src/lib/components/SettingsCard.svelte";
    import TextInput from "@openchat/ui/src/lib/components/TextInput.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import { principalProblem } from "@src/logic/admin/fieldChecks";
    import { BRIDGE_PLATFORMS } from "@src/logic/admin/operatorFunctions.svelte";
    import { onMount } from "svelte";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
        translate: (key: ResourceKey) => string;
    }

    let { admin, translate }: Props = $props();

    const ops = $derived(admin.ops);
    onMount(() => admin.loadOperatorFunctions());

    const out = (form: string, busy: boolean) => admin.cardOutcome(form, busy, translate);

    function setCallPush(on: boolean): void {
        ops.callPushEnabled = on;
        void admin.outcomes.run("callPush", () => ops.applyCallPush());
    }
</script>

<SettingsCard
    title="Native call push"
    help="Rings the native apps for incoming calls with a push notification. Off is the kill switch."
    icon="phone"
    outcome={out("callPush", ops.busy.has("callPush"))}>
    {#snippet aside()}
        <Toggle
            on={ops.callPushEnabled}
            ariaLabel="Native call push"
            disabled={ops.busy.has("callPush")}
            onChange={setCallPush} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="Alchemy API key"
    help="The key for Solana RPC, passed on to every MultiUser canister."
    icon="key"
    outcome={out("alchemy", ops.busy.has("alchemyKey"))}>
    <TextInput
        value={ops.alchemyApiKey}
        placeholder="New key"
        type="password"
        mono
        onInput={(v) => (ops.alchemyApiKey = v)} />
    {#snippet actions()}
        <Button
            label="Unset"
            variant="secondary"
            disabled={ops.busy.has("alchemyKey")}
            onClick={() =>
                void admin.outcomes.run("alchemy", () => ops.setAlchemyApiKey(undefined))} />
        <Button
            label="Set"
            busy={ops.busy.has("alchemyKey")}
            disabled={ops.busy.has("alchemyKey") || ops.alchemyApiKey.trim() === ""}
            onClick={() =>
                void admin.outcomes.run("alchemy", () =>
                    ops.setAlchemyApiKey(ops.alchemyApiKey.trim()),
                )} />
    {/snippet}
</SettingsCard>

<SettingsCard
    title="MiniApp service principal"
    help="The principal of the service the MiniApp calls OpenChat as."
    icon="smartphone"
    outcome={out("miniApp", ops.busy.has("miniAppPrincipal"))}>
    <TextInput
        value={ops.miniAppServicePrincipal}
        placeholder="Service principal"
        mono
        paste
        error={principalProblem(ops.miniAppServicePrincipal)}
        onInput={(v) => (ops.miniAppServicePrincipal = v)} />
    {#snippet actions()}
        <Button
            label="Set"
            busy={ops.busy.has("miniAppPrincipal")}
            disabled={ops.busy.has("miniAppPrincipal") ||
                ops.miniAppServicePrincipal.trim() === "" ||
                principalProblem(ops.miniAppServicePrincipal) !== undefined}
            onClick={() =>
                void admin.outcomes.run("miniApp", () => ops.setMiniAppServicePrincipal())} />
    {/snippet}
</SettingsCard>

{#each BRIDGE_PLATFORMS as platform (platform)}
    {@const form = `bridge-${platform}`}
    {@const busy = ops.busy.has("bridgeBot")}
    <SettingsCard
        title={`${BRIDGE_PLATFORM_NAMES[platform]} bridge bot`}
        help={`The bot that bridges ${BRIDGE_PLATFORM_NAMES[platform]} chats into OpenChat.`}
        icon="bot"
        outcome={admin.cardOutcome(form, false, translate)}>
        <TextInput
            value={ops.bridgeBotIds[platform]}
            placeholder="Bot id"
            mono
            paste
            onInput={(v) => (ops.bridgeBotIds[platform] = v)} />
        {#snippet actions()}
            <Button
                label="Unset"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                    void admin.outcomes.run(form, () => ops.setBridgeBot(platform, undefined))} />
            <Button
                label="Set"
                {busy}
                disabled={busy || ops.bridgeBotIds[platform].trim() === ""}
                onClick={() =>
                    void admin.outcomes.run(form, () =>
                        ops.setBridgeBot(platform, ops.bridgeBotIds[platform].trim()),
                    )} />
        {/snippet}
    </SettingsCard>
{/each}
