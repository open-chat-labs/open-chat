<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    export let timestamp: bigint;
    $: text = $_("directChatCreatedAt");
</script>

<NonMessageEvent {text} {timestamp} />
