<!-- Authority reports: the register of NCA CSEA-IRP filings. Four tiles (overdue, due soon, on
     time, filed), then the due reports most urgent first, each with its age and how much of its
     internal SLA target is left (a bar and "8h left of 72h"), and the filed ones with their
     portal reference. Filings are recorded from the moderation report card, not here. -->
<script lang="ts">
    import DataTable from "@openchat/ui/src/lib/components/DataTable.svelte";
    import Pill from "@openchat/ui/src/lib/components/Pill.svelte";
    import StatCard from "@openchat/ui/src/lib/components/StatCard.svelte";
    import {
        ageOf,
        byUrgency,
        formatAge,
        formatSlaLeft,
        slaStanding,
        type DueRow,
        type FiledRow,
    } from "@src/logic/admin/authorityReports.svelte";
    import { now } from "@src/stores/time";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
    }

    let { admin }: Props = $props();

    const reports = $derived(admin.reports);
    const due = $derived(byUrgency(reports.due, $now));
    const counts = $derived(admin.reportCounts($now));
    const tableState = $derived(
        reports.error !== undefined && !reports.loaded
            ? "error"
            : !reports.loaded
              ? "loading"
              : "ready",
    );

    const DUE_COLUMNS = [
        { key: "report", label: "Report", width: "96px" },
        { key: "since", label: "Due since", nowrap: true },
        { key: "age", label: "Age", width: "72px", nowrap: true },
        { key: "left", label: "Time left", width: "220px" },
        { key: "flags", label: "Flags", width: "150px" },
    ];
    const FILED_COLUMNS = [
        { key: "report", label: "Report", width: "96px" },
        { key: "reference", label: "Reference" },
        { key: "filed", label: "Filed", nowrap: true },
        { key: "flags", label: "Flags", width: "150px" },
    ];

    const date = (ms: number): string => new Date(ms).toLocaleString();
</script>

<div class="tiles">
    <StatCard
        label="Overdue"
        value={counts === undefined ? "–" : String(counts.overdue)}
        emphasis />
    <StatCard label="Due soon" value={counts === undefined ? "–" : String(counts.soon)} />
    <StatCard
        label="On time"
        value={counts === undefined
            ? "–"
            : String(reports.due.length - counts.overdue - counts.soon)} />
    <StatCard label="Filed" value={counts === undefined ? "–" : String(counts.filed)} />
</div>

<DataTable
    title="Due"
    count={reports.due.length}
    columns={DUE_COLUMNS}
    rows={due}
    rowKey={(row: DueRow) => row.report_index}
    rowTone={(row: DueRow) => (slaStanding(row, $now).state === "overdue" ? "danger" : "default")}
    state={tableState === "ready" && due.length === 0 ? "empty" : tableState}
    emptyTitle="Nothing due"
    emptyBody="Every report has been filed with the authority."
    errorTitle="Couldn’t load the register"
    errorBody={reports.error ?? ""}
    onRetry={() => void reports.load()}
    minWidth={720}>
    {#snippet actions()}
        <span class="sla">SLA: urgent 24h · standard 72h · due soon under a quarter left</span>
    {/snippet}
    {#snippet cell(row: DueRow, key: string)}
        {#if key === "report"}
            <span class="mono">#{row.report_index}</span>
        {:else if key === "since"}
            {date(row.created)}
        {:else if key === "age"}
            <span class="mono">{formatAge(ageOf(row, $now))}</span>
        {:else if key === "left"}
            {@const standing = slaStanding(row, $now)}
            <div class="sla-left {standing.state}">
                <span class="bar"
                    ><span style:width={`${Math.round(standing.used * 100)}%`}></span></span>
                <span class="sla-text">{formatSlaLeft(standing)}</span>
            </div>
        {:else if key === "flags"}
            <span class="flags">
                {#if slaStanding(row, $now).state === "overdue"}
                    <Pill label="OVERDUE" tone="danger" size="sm" />
                {/if}
                <Pill
                    label={row.urgent ? "urgent" : "standard"}
                    tone={row.urgent ? "warning" : "neutral"}
                    size="sm" />
            </span>
        {/if}
    {/snippet}
</DataTable>

<DataTable
    title="Filed"
    count={reports.filed.length}
    columns={FILED_COLUMNS}
    rows={reports.filed}
    rowKey={(row: FiledRow) => row.report_index}
    state={tableState === "ready" && reports.filed.length === 0 ? "empty" : tableState}
    emptyTitle="Nothing filed yet"
    emptyBody="Filed reports appear here with their reference."
    errorTitle="Couldn’t load the register"
    errorBody={reports.error ?? ""}
    onRetry={() => void reports.load()}
    minWidth={720}>
    {#snippet cell(row: FiledRow, key: string)}
        {#if key === "report"}
            <span class="mono">#{row.report_index}</span>
        {:else if key === "reference"}
            <span class="mono ref">{row.portal_reference}</span>
        {:else if key === "filed"}
            {date(row.filed_at)}
        {:else if key === "flags"}
            <span class="flags">
                {#if row.urgent}<Pill label="urgent" tone="warning" size="sm" />{/if}
                {#if row.unverified}<Pill label="unverified" tone="danger" size="sm" />{/if}
            </span>
        {/if}
    {/snippet}
</DataTable>

<style lang="scss">
    .tiles {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-10);
    }

    .sla {
        font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
        color: var(--ink-3);
    }

    .mono {
        font-family: var(--font-mono);
    }

    .ref {
        color: var(--ink-2);
        overflow-wrap: anywhere;
    }

    .flags {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-4);
    }

    .sla-left {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-width: 0;
    }

    .bar {
        display: block;
        height: 4px;
        border-radius: var(--radius-pill);
        background: var(--overlay-2);
        overflow: hidden;

        span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: var(--status-online);
        }

        .soon & span {
            background: var(--status-warning);
        }

        .overdue & span {
            background: var(--status-danger);
        }
    }

    .sla-text {
        font: var(--weight-medium) var(--text-sm) / 1.2 var(--font-mono);
        color: var(--ink-2);

        .soon & {
            color: var(--status-warning);
        }

        .overdue & {
            color: var(--status-danger);
        }
    }
</style>
