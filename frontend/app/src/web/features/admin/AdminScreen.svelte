<!-- /admin (region "admin"): the platform operator console. Someone who isn't a platform operator
     gets the old Admin page's refusal; an operator, for now, a note that the console isn't built
     here yet. TODO(design): the console (the old desktop's `home/admin`: translation corrections,
     operator functions, pending operator proposals, authority reports, the vault log) has no
     design; GAPS.md, "Platform operators and moderators". Its words are English only, as the old
     console's. -->
<script lang="ts">
    import { platformOperatorStore } from "@client";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import { navigate } from "@src/utils/navigation";
    import type { MiddleRegion, ScreenProps } from "../app/screens";

    let { region }: ScreenProps<Extract<MiddleRegion, { kind: "admin" }>> = $props();
</script>

<div class="admin" data-region={region.kind}>
    {#if $platformOperatorStore}
        <EmptyState
            preset="no-results"
            icon="alert"
            title="Admin"
            body="The operator console isn't in the new UI yet. Its actions without a screen are in the browser console: platformOperator and platformModerator."
            actionLabel="" />
    {:else}
        <EmptyState
            preset="error"
            title="Unauthorised"
            body="Only platform operators can access the admin area"
            actionLabel="Back to safety"
            actionHandler={() => navigate("/")} />
    {/if}
</div>

<style lang="scss">
    .admin {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>
