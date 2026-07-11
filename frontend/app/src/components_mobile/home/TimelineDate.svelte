<script lang="ts">
    import { BodySmall } from "component-lib";
    import type { OpenChat } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        timestamp: bigint;
    }

    let { timestamp }: Props = $props();
</script>

<div class="date-label">
    <BodySmall align={"center"} colour={"textSecondary"}>
        {client.formatMessageDate(timestamp, $_("today"), $_("yesterday"))}
    </BodySmall>
</div>

<style lang="scss">
    .date-label {
        text-align: center;
        padding: var(--sp-xs) var(--sp-md);
        background-color: var(--background-2);
        box-shadow: var(--menu-sh);
        color: var(--text-secondary);
        width: fit-content;
        min-width: 100px;
        margin: 0 auto;
        border-radius: var(--rad-circle);
        margin-bottom: var(--sp-lg);
    }
</style>
