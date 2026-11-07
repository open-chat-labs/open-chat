<!-- You → Bots (native design notes §3.11, "copyable connection details"): what a bot developer
     needs to connect to OpenChat (the IC host, the OpenStorage index and OpenChat's public key),
     loaded as the page opens, as the web's profile and the old Bot configuration load it. -->
<script lang="ts">
    import type { BotClientConfigData, OpenChat } from "@client";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import SettingsCopy from "@openchat/ui/src/native/SettingsCopy.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../../app/screens";

    let { context }: { context: ScreenContext } = $props();

    const client = getContext<OpenChat>("client");

    type Config = { kind: "loading" } | { kind: "loaded"; config: BotClientConfigData } | { kind: "failed" };
    let config = $state<Config>({ kind: "loading" });

    onMount(async () => {
        try {
            config = { kind: "loaded", config: await client.getBotConfig() };
        } catch (err) {
            console.warn("Unable to load the bot configuration", err);
            config = { kind: "failed" };
        }
    });

    function copied(label: string) {
        context.toast($_("native.you.bots.copied", { values: { label } }));
    }

    const ROWS = [
        { key: "icHost", label: "native.you.bots.icHost", nowrap: true },
        { key: "openStorageIndexCanister", label: "native.you.bots.storageIndex", nowrap: true },
        { key: "ocPublicKey", label: "native.you.bots.publicKey", nowrap: false },
    ] as const;
</script>

<p class="intro">{$_("native.you.bots.intro")}</p>

{#if config.kind === "loading"}
    <div class="state"><Spinner /></div>
{:else if config.kind === "failed"}
    <p class="intro">{$_("bots.config.failure")}</p>
{:else}
    {@const values = config.config}
    <SettingsGroup label={$_("native.you.bots.connection")}>
        {#each ROWS as row (row.key)}
            <SettingsCopy
                label={$_(row.label)}
                value={values[row.key]}
                nowrap={row.nowrap}
                onCopy={() => copied($_(row.label))} />
        {/each}
    </SettingsGroup>
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .intro {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(13.5px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .state {
        display: grid;
        place-items: center;
        padding: var(--space-24);
    }
</style>
