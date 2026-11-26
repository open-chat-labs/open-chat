<!-- /admin/:section (region "admin", the main pane): the platform operator console's open section,
     beside its list of sections (AdminPanelScreen), as the wallet's pages sit beside its tokens:
     the library page header with the section's name (and Refresh, for the lists that change under
     you), its one-line intro, then the section in a centred column (wider for the tables). Every
     operator function is its own settings card, whose footer says how its last action went (in
     place of the old console's toasts and the error line at the bottom of the tab). Someone who
     isn't a platform operator gets the old Admin page's refusal. Its words are English only, as
     the old console's. The design: the Claude Design canvas "Admin Console" (2026-11-26). -->
<script lang="ts">
    import { platformOperatorStore, type OpenChat, type ResourceKey } from "@client";
    import { interpolateNewUi, reviewingTranslations } from "@i18n/i18n";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import PageHeader from "@openchat/ui/src/lib/components/PageHeader.svelte";
    import { adminSection } from "@src/logic/admin/adminSections";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import { adminConsole } from "./adminConsole.svelte";
    import DangerSection from "./sections/DangerSection.svelte";
    import InfrastructureSection from "./sections/InfrastructureSection.svelte";
    import IntegrationsSection from "./sections/IntegrationsSection.svelte";
    import ModerationSection from "./sections/ModerationSection.svelte";
    import MoneySection from "./sections/MoneySection.svelte";
    import ProposalsSection from "./sections/ProposalsSection.svelte";
    import PuzzleSection from "./sections/PuzzleSection.svelte";
    import ReportsSection from "./sections/ReportsSection.svelte";
    import TranslationsSection from "./sections/TranslationsSection.svelte";
    import VaultSection from "./sections/VaultSection.svelte";

    let { region, context }: ScreenProps<Extract<MiddleRegion, { kind: "admin" }>> = $props();

    const client = getContext<OpenChat>("client");
    const admin = adminConsole(client);

    const section = $derived(adminSection(region.section));
    const wide = $derived(
        section.id === "reports" || section.id === "translations" || section.id === "vault",
    );

    // While the corrections are reviewed, their locales are switched to and back to load them;
    // the app stays up meanwhile (App's `reviewingTranslations`)
    $effect(() => {
        reviewingTranslations.set($platformOperatorStore && section.id === "translations");
    });
    onDestroy(() => reviewingTranslations.set(false));

    const translate = (key: ResourceKey): string => interpolateNewUi($_, key);

    const refreshing = $derived(section.id === "proposals" ? admin.proposals.loading : false);

    function refresh(): void {
        if (section.id === "proposals") void admin.proposals.refresh();
        else if (section.id === "reports") void admin.reports.load();
    }
</script>

<div class="admin" data-region={region.kind}>
    {#if $platformOperatorStore}
        <PageHeader
            title={section.label}
            onBack={context.narrow ? () => navigate(context.back ?? "/admin") : undefined}>
            {#if section.id === "proposals" || section.id === "reports"}
                <Button
                    label="Refresh"
                    icon="refresh"
                    variant="secondary"
                    busy={refreshing}
                    disabled={refreshing}
                    onClick={refresh} />
            {/if}
        </PageHeader>
        <div class="scroll">
            <div class="content" class:wide>
                <p class="intro">{section.intro}</p>
                {#key section.id}
                    {#if section.id === "proposals"}
                        <ProposalsSection {admin} {translate} />
                    {:else if section.id === "reports"}
                        <ReportsSection {admin} />
                    {:else if section.id === "infrastructure"}
                        <InfrastructureSection {admin} {translate} />
                    {:else if section.id === "money"}
                        <MoneySection {admin} {translate} />
                    {:else if section.id === "moderation"}
                        <ModerationSection {admin} {translate} />
                    {:else if section.id === "integrations"}
                        <IntegrationsSection {admin} {translate} />
                    {:else if section.id === "puzzle"}
                        <PuzzleSection {admin} {translate} />
                    {:else if section.id === "danger"}
                        <DangerSection {admin} {translate} />
                    {:else if section.id === "translations"}
                        <TranslationsSection {admin} />
                    {:else if section.id === "vault"}
                        <VaultSection {admin} />
                    {/if}
                {/key}
            </div>
        </div>
    {:else}
        <div class="refusal">
            <EmptyState
                preset="error"
                title="Unauthorised"
                body="Only platform operators can access the admin area"
                actionLabel="Back to safety"
                actionHandler={() => navigate("/")} />
        </div>
    {/if}
</div>

<style lang="scss">
    .admin {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        container-type: inline-size;
    }

    .refusal {
        display: grid;
        place-items: center;
        height: 100%;
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    .content {
        display: flex;
        flex-direction: column;
        gap: var(--space-18);
        max-width: 760px;
        margin: 0 auto;
        padding: var(--space-24) var(--space-24) 96px;

        &.wide {
            max-width: 1040px;
        }
    }

    .intro {
        margin: 0;
        font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }
</style>
