<svelte:options immutable={true} />

<script lang="ts">
    import { apiKey } from "../../services/serviceContainer";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { CryptocurrencyContent } from "../../domain/chat/chat";
    import { currentUserKey } from "../../fsm/home.controller";
    import type { CreatedUser } from "../../domain/user/user";

    export let content: CryptocurrencyContent;
    export let me: boolean = false;
    export let reply: boolean = false;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let confirmedAmount =
        content.transfer.kind === "completed_icp_transfer" ? content.transfer.amountE8s : 0;
</script>

{#if content.transfer.kind === "completed_icp_transfer"}
    <h1>This is the read only mode</h1>
    <pre>{confirmedAmount}</pre>
{/if}

<style type="text/scss">
</style>
