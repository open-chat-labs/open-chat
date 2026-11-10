<!-- Text in a details card (a bio, a group's description, its rules), formatted as messages are
     (core/Markdown), as the web's panels show it. A settings-row, so the card divides it. -->
<script lang="ts">
    import Markdown from "@src/core/Markdown.svelte";

    let { text }: { text: string } = $props();
</script>

<div class="settings-row text"><Markdown inline={false} {text} /></div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .text {
        padding: 14px 16px;
        font: var(--weight-regular) text-size(14.5px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        overflow-wrap: anywhere;
    }
</style>
