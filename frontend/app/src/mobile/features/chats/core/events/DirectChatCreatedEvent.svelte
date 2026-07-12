<script lang="ts">
    import { _ } from "svelte-i18n";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    interface Props {
        timestamp: bigint;
    }

    let { timestamp }: Props = $props();
    let text = $derived($_("directChatCreatedAt"));
</script>

<NonMessageEvent {text} {timestamp} />
