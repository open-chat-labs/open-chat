<script lang="ts">
    import { currentUser, emptyBotInstance, type ExternalBot } from "openchat-client";
    import AutoBotBuilder from "./AutoBotBuilder.svelte";

    // In order for the binding to work, the candidate bot has to be stored in a $state rune
    // so we need this svelte 5 wrapper to make this work from the (svelte 4) make proposal modal

    interface Props {
        onUpdate: (bot: ExternalBot) => void;
        schemaLoaded: boolean;
        valid: boolean;
        principal: string;
    }

    let {
        valid = $bindable(),
        schemaLoaded = $bindable(),
        onUpdate,
        principal = $bindable(),
    }: Props = $props();

    let candidate = $state(emptyBotInstance($currentUser.userId));
</script>

<AutoBotBuilder
    {candidate}
    bind:valid
    bind:schemaLoaded
    bind:principal
    {onUpdate}
    nameDirty={true}
    mode={"register"} />
