<!-- /admin (region "admin"): the platform operator console, the old desktop's `home/admin` ported
     plainly (the user's decision, 2026-11-12): its five tabs, each opened afresh as the old one's
     were, on the logic the old console now uses too (`logic/admin`). Someone who isn't a platform
     operator gets the old Admin page's refusal. Its words are English only, as the old console's.
     TODO(design): the console has no design; drawn from the library's page header, tabs, buttons
     and toggles, and plain fields, cards and tables (GAPS.md, "Platform operators and
     moderators"). -->
<script lang="ts">
    import {
        allUsersStore,
        currentUserIdStore,
        platformOperatorStore,
        type OpenChat,
        type ResourceKey,
        type TranslationCorrection,
        type UserSummary,
    } from "@client";
    import { interpolateNewUi, reviewingTranslations } from "@i18n/i18n";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import PageHeader from "@openchat/ui/src/lib/components/PageHeader.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import { dailyPuzzleGames } from "@src/core/dailyPuzzle/registry";
    import { AuthorityReports } from "@src/logic/admin/authorityReports.svelte";
    import { DailyPuzzleOperator } from "@src/logic/admin/dailyPuzzleOperator.svelte";
    import { OperatorFunctions } from "@src/logic/admin/operatorFunctions.svelte";
    import { PendingProposals } from "@src/logic/admin/pendingProposals.svelte";
    import { TranslationCorrections } from "@src/logic/admin/translationCorrections.svelte";
    import { VaultLog } from "@src/logic/admin/vaultLog.svelte";
    import { toastStore } from "@src/stores/toast";
    import { now } from "@src/stores/time";
    import { regenerateOptions } from "@src/utils/dailyPuzzleOperator";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import AuthorityReportsPanel from "./AuthorityReportsPanel.svelte";
    import type { ConsoleOutcome } from "./console";
    import OperatorFunctionsPanel from "./OperatorFunctionsPanel.svelte";
    import PendingProposalsPanel from "./PendingProposalsPanel.svelte";
    import TranslationCorrectionsPanel from "./TranslationCorrectionsPanel.svelte";
    import VaultLogPanel from "./VaultLogPanel.svelte";

    let { region }: ScreenProps<Extract<MiddleRegion, { kind: "admin" }>> = $props();

    const client = getContext<OpenChat>("client");

    const TABS = [
        "Translation Corrections",
        "Operator functions",
        "Pending operator proposals",
        "Authority reports",
        "Vault log",
    ];

    // The open tab, with its state made fresh each time it's opened, as the old console's tabs
    // were (each mounted anew, reading what's there now)
    type Panel =
        | { kind: "translations"; corrections: TranslationCorrections }
        | { kind: "operator"; ops: OperatorFunctions; puzzle: DailyPuzzleOperator }
        | { kind: "proposals"; proposals: PendingProposals }
        | { kind: "authority"; reports: AuthorityReports }
        | { kind: "vaultlog"; log: VaultLog };

    function panelFor(index: number): Panel {
        switch (index) {
            case 1:
                return {
                    kind: "operator",
                    ops: new OperatorFunctions(client),
                    puzzle: new DailyPuzzleOperator(client),
                };
            case 2:
                return { kind: "proposals", proposals: new PendingProposals(client) };
            case 3:
                return { kind: "authority", reports: new AuthorityReports(client) };
            case 4:
                return { kind: "vaultlog", log: new VaultLog(client) };
            default:
                return { kind: "translations", corrections: new TranslationCorrections(client) };
        }
    }

    let tab = $state(0);
    let panel = $state<Panel | undefined>(undefined);

    // The open tab, picked again, stays as it is (SegmentedTabs reports it too): the old console
    // only remounted a tab when another was picked
    function select(index: number) {
        if (index === tab && panel !== undefined) return;
        tab = index;
        panel = panelFor(index);
    }

    // Only an operator's console asks for anything
    $effect(() => {
        if ($platformOperatorStore && panel === undefined) select(tab);
    });

    // While the corrections are reviewed, their locales are switched to and back to load them;
    // the app stays up meanwhile (App's `reviewingTranslations`)
    $effect(() => {
        reviewingTranslations.set(panel?.kind === "translations");
    });
    onDestroy(() => reviewingTranslations.set(false));

    const regenerate = regenerateOptions(Object.keys(dailyPuzzleGames));

    function report(outcome: ConsoleOutcome | undefined): void {
        if (outcome?.kind === "success") {
            toastStore.showSuccessToast(outcome.message);
        } else if (outcome?.kind === "failed") {
            toastStore.showFailureToast(outcome.message, outcome.err);
        }
    }

    const translate = (key: ResourceKey): string => interpolateNewUi($_, key);
    const userName = $derived(
        (userId: string): string => $allUsersStore.get(userId)?.username ?? userId,
    );
    const userOf = $derived((userId: string): UserSummary | undefined => $allUsersStore.get(userId));
    // the current value and English of a key, in a locale (the corrections' own columns)
    const textIn = $derived((key: string, inLocale: string): string => {
        return $_(key, { locale: inLocale });
    });

    function previewCorrection(correction: TranslationCorrection): void {
        client.previewTranslationCorrection(correction.key, correction.value);
    }

    function proposedAt(correction: TranslationCorrection): string {
        return client.toDatetimeString(new Date(Number(correction.proposedAt)));
    }
</script>

<div class="admin" data-region={region.kind}>
    {#if $platformOperatorStore}
        <div class="console">
            <PageHeader title="Admin" />
            <div class="tabs">
                <SegmentedTabs
                    labels={TABS}
                    selectedIndex={tab}
                    dotIndexes={[]}
                    onSelect={select} />
            </div>
            <div class="panel">
                {#if panel?.kind === "translations"}
                    <TranslationCorrectionsPanel
                        corrections={panel.corrections}
                        {userName}
                        {textIn}
                        {proposedAt}
                        onPreview={previewCorrection}
                        onReport={report} />
                {:else if panel?.kind === "operator"}
                    <OperatorFunctionsPanel
                        ops={panel.ops}
                        puzzle={panel.puzzle}
                        regenerateOptions={regenerate}
                        {translate}
                        onPauseEventLoop={() => client.pauseEventLoop()}
                        onResumeEventLoop={() => client.resumeEventLoop()}
                        onReport={report} />
                {:else if panel?.kind === "proposals"}
                    <PendingProposalsPanel
                        proposals={panel.proposals}
                        currentUserId={$currentUserIdStore}
                        {userOf}
                        {translate}
                        onReport={report} />
                {:else if panel?.kind === "authority"}
                    <AuthorityReportsPanel reports={panel.reports} now={$now} />
                {:else if panel?.kind === "vaultlog"}
                    <VaultLogPanel log={panel.log} />
                {/if}
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
        height: 100%;
        background: var(--surface-0);
    }

    .refusal {
        display: grid;
        place-items: center;
        height: 100%;
    }

    .console {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .tabs {
        padding: 0 var(--space-16) var(--space-12);
        max-width: 760px;
    }

    .panel {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 0 var(--space-16) var(--space-24);
    }

    // The console's plain parts, shared by its panels. TODO(design): none in the library.
    .console {
        :global(.admin-card) {
            display: flex;
            flex-direction: column;
            gap: var(--space-10);
            padding: var(--space-16);
            border-radius: var(--radius-lg);
            background: var(--surface-1);
            box-shadow: inset 0 0 0 1px var(--line-1);
        }

        :global(.admin-card-title) {
            margin: 0;
            font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
            color: var(--ink);
        }

        :global(.admin-hint) {
            margin: 0;
            font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
            color: var(--ink-3);
            overflow-wrap: anywhere;
        }

        :global(.admin-error) {
            margin: 0;
            font: var(--weight-medium) var(--text-sm) / 1.5 var(--font-sans);
            color: var(--status-danger);
        }

        :global(.admin-label) {
            font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
            color: var(--ink-3);
        }

        :global(.admin-input) {
            box-sizing: border-box;
            width: 100%;
            min-width: 0;
            padding: var(--space-8) var(--space-12);
            border: none;
            border-radius: var(--radius-md);
            background: var(--surface-2);
            box-shadow: inset 0 0 0 1px var(--line-2);
            color: var(--ink);
            font: var(--weight-regular) var(--text-base) / 1.4 var(--font-sans);
            color-scheme: light dark;

            &:focus-visible {
                outline: none;
                box-shadow: inset 0 0 0 1px var(--accent);
            }

            &:disabled {
                color: var(--ink-3);
            }

            &[aria-invalid="true"] {
                box-shadow: inset 0 0 0 1px var(--status-danger);
            }
        }

        :global(.admin-table) {
            width: 100%;
            border-collapse: collapse;
            font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
            color: var(--ink);
        }

        :global(.admin-table th) {
            position: sticky;
            top: 0;
            z-index: 1;
            background: var(--surface-1);
            font-weight: var(--weight-semibold);
            color: var(--ink-2);
        }

        :global(.admin-table th),
        :global(.admin-table td) {
            padding: var(--space-8) var(--space-10);
            text-align: start;
            vertical-align: middle;
            border-bottom: 1px solid var(--line-1);
        }

        // a row of a field (or words) and its controls: the controls keep their size
        :global(.admin-row) {
            display: flex;
            align-items: center;
            gap: var(--space-10);
        }

        :global(.admin-row > :not(.admin-input, .admin-hint, .admin-grow)) {
            flex: none;
        }

        :global(.admin-row > .admin-grow) {
            flex: 1;
            min-width: 0;
        }

        :global(.admin-mono) {
            font-family: var(--font-mono);
        }
    }
</style>
