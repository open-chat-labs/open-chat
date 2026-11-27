<!-- /admin's left column (region "admin"): the operator console's sections in SectionNav, where the
     chat list or the wallet's tokens sit. Review first, with what needs a person on its rows (the
     proposals awaiting you, the reports overdue or due soon), then the operator functions by
     subject, content and compliance. A row opens its section in the main pane (/admin/:section).
     It loads the proposals and the register for those rows, and drops the console's state as it
     closes. Someone who isn't a platform operator sees nothing here (the main pane refuses). -->
<script lang="ts">
    import { currentUserIdStore, platformOperatorStore, routeStore, type OpenChat } from "@client";
    import SectionNav from "@openchat/ui/src/lib/components/SectionNav.svelte";
    import {
        ADMIN_SECTION_GROUPS,
        adminSection,
        adminSectionPath,
        proposalsStatus,
        reportsStatus,
        type AdminSectionId,
        type SectionStatus,
    } from "@src/logic/admin/adminSections";
    import { now } from "@src/stores/time";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy } from "svelte";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import { adminConsole, closeAdminConsole } from "./adminConsole.svelte";

    let { region }: ScreenProps<Extract<LeftRegion, { kind: "admin" }>> = $props();

    const client = getContext<OpenChat>("client");
    const admin = adminConsole(client);

    // the rows' counts, and the Pending proposals and Authority reports sections, need these;
    // loaded once the user is an operator (who may become one while the console is open, as the
    // old console's panels mounted only then)
    let loaded = false;
    $effect(() => {
        if (!$platformOperatorStore || loaded) return;
        loaded = true;
        void admin.proposals.refresh();
        void admin.reports.load();
    });
    onDestroy(closeAdminConsole);

    // the open section: the URL's, or the default (/admin alone, on a wide window, opens it)
    const selected = $derived(
        $routeStore.kind === "admin_route" ? adminSection($routeStore.section).id : undefined,
    );

    const status = $derived<Partial<Record<AdminSectionId, SectionStatus>>>({
        proposals: proposalsStatus(admin.proposalCounts($currentUserIdStore)),
        reports: reportsStatus(admin.reportCounts($now)),
    });

    const groups = $derived(
        ADMIN_SECTION_GROUPS.map((g) => ({
            label: g.label,
            items: g.sections.map((s) => ({
                id: s.id,
                label: s.label,
                icon: s.icon,
                danger: s.id === "danger",
                ...(status[s.id] ?? { sub: s.hint }),
            })),
        })),
    );
</script>

<div class="admin-panel" data-region={region.kind}>
    {#if $platformOperatorStore}
        <SectionNav
            title="Admin"
            tag="Operator"
            ariaLabel="Admin sections"
            {groups}
            {selected}
            onSelect={(id) => navigate(adminSectionPath(adminSection(id).id))} />
    {/if}
</div>

<style lang="scss">
    .admin-panel {
        height: 100%;
        min-height: 0;
    }
</style>
