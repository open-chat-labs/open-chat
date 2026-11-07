<!-- You → Bots (native design notes §3.11, "copyable connection details"): what a bot developer
     needs to connect to OpenChat (the IC host, the OpenStorage index and OpenChat's public key),
     fetched as the You tab opens (botConfig), as the web's profile and the old Bot configuration
     load it; the card shows at once, with a small spinner in it should they still be on their way. -->
<script lang="ts">
    import type { OpenChat } from "@client";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import SettingsCopy from "@openchat/ui/src/native/SettingsCopy.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../../app/screens";
    import { botConfig } from "./botConfig.svelte";

    let { context }: { context: ScreenContext } = $props();

    const client = getContext<OpenChat>("client");

    const config = $derived(botConfig.state);
    // in already, or on their way, unless the fetch failed: tried again
    onMount(() => void botConfig.load(client));

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

{#if config.kind === "failed"}
    <p class="intro">{$_("bots.config.failure")}</p>
{:else}
    <SettingsGroup label={$_("native.you.bots.connection")}>
        {#if config.kind === "loaded"}
            {#each ROWS as row (row.key)}
                <SettingsCopy
                    label={$_(row.label)}
                    value={config.config[row.key]}
                    nowrap={row.nowrap}
                    onCopy={() => copied($_(row.label))} />
            {/each}
        {:else}
            <div class="settings-row waiting"><Spinner size={20} /></div>
        {/if}
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

    // the details still on their way: a row's height, in the card
    .waiting {
        display: grid;
        place-items: center;
        min-height: 64px;
    }
</style>
