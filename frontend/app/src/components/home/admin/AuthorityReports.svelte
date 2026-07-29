<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext, onMount } from "svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");

    type DueRow = {
        report_index: number;
        urgent: boolean;
        created: number;
    };
    type FiledRow = {
        report_index: number;
        portal_reference: string;
        filed_at: number;
        urgent: boolean;
        unverified: boolean;
    };

    let due: DueRow[] = $state([]);
    let filed: FiledRow[] = $state([]);
    let loaded = $state(false);
    let error = $state<string | undefined>(undefined);

    // The authority-reports register: "due" rows are created by UpheldAsCsam verdicts (the
    // s.66 reporting duty), and move to "filed" once the CSEA-IRP portal reference (URN) is
    // recorded. The filed list is the compliance evidence that reporting deadlines were met.
    function load() {
        error = undefined;
        client
            .authorityReports()
            .then((json) => {
                if (json === undefined) {
                    error = "Failed to load the register (platform operators only)";
                    return;
                }
                const register = JSON.parse(json);
                due = (register.due ?? []).sort((a: DueRow, b: DueRow) => a.created - b.created);
                filed = (register.filed ?? []).sort(
                    (a: FiledRow, b: FiledRow) => b.filed_at - a.filed_at,
                );
                loaded = true;
            })
            .catch(() => (error = "Failed to load the register"));
    }

    // Internal SLA targets, NOT statutory deadlines: the regulations require reporting "as
    // soon as reasonably practicable" with no fixed period, so these are the operating
    // targets we hold ourselves to (and the evidence we would point to)
    const URGENT_SLA_MS = 24 * 60 * 60 * 1000;
    const STANDARD_SLA_MS = 72 * 60 * 60 * 1000;

    function ageOf(row: DueRow): number {
        return Date.now() - row.created;
    }

    function overdue(row: DueRow): boolean {
        return ageOf(row) > (row.urgent ? URGENT_SLA_MS : STANDARD_SLA_MS);
    }

    function formatAge(ms: number): string {
        const hours = Math.floor(ms / (60 * 60 * 1000));
        if (hours < 48) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    }

    onMount(load);
</script>

<div class="authority-reports">
    <div class="hint">
        The register of authority (NCA CSEA-IRP) filings - the compliance evidence that reporting
        duties were met. Filings are recorded from the moderation report itself.
    </div>

    <h4>Due ({due.length})</h4>
    {#if loaded && due.length === 0}
        <div class="empty">Nothing due</div>
    {/if}
    {#if due.length > 0}
        <div class="hint">
            File from the moderation report card. Ages are measured against our internal SLA targets
            (urgent: 24h, standard: 72h) - the statutory duty is "as soon as reasonably
            practicable".
        </div>
        <table>
            <thead>
                <tr>
                    <th>Report</th>
                    <th>Due since</th>
                    <th>Age</th>
                    <th>Flags</th>
                </tr>
            </thead>
            <tbody>
                {#each due as row (row.report_index)}
                    <tr class:overdue={overdue(row)}>
                        <td>#{row.report_index}</td>
                        <td>{new Date(row.created).toLocaleString()}</td>
                        <td>
                            {formatAge(ageOf(row))}
                            {#if overdue(row)}<span class="overdue-badge">OVERDUE</span>{/if}
                        </td>
                        <td>{row.urgent ? "urgent" : ""}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    <h4>Filed ({filed.length})</h4>
    {#if loaded && filed.length === 0}
        <div class="empty">Nothing filed yet</div>
    {/if}
    {#if filed.length > 0}
        <table>
            <thead>
                <tr>
                    <th>Report</th>
                    <th>Reference</th>
                    <th>Filed</th>
                    <th>Flags</th>
                </tr>
            </thead>
            <tbody>
                {#each filed as row (row.report_index)}
                    <tr>
                        <td>#{row.report_index}</td>
                        <td class="ref">{row.portal_reference}</td>
                        <td>{new Date(row.filed_at).toLocaleString()}</td>
                        <td>
                            {[
                                row.urgent ? "urgent" : undefined,
                                row.unverified ? "unverified" : undefined,
                            ]
                                .filter((f) => f !== undefined)
                                .join(", ")}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    {#if error !== undefined}
        <ErrorMessage>{error}</ErrorMessage>
    {/if}
</div>

<style lang="scss">
    .authority-reports {
        flex: auto;
        @include nice-scrollbar();
        padding: $sp4;
        display: flex;
        flex-direction: column;
        gap: $sp4;
        max-width: 600px;
    }
    .hint {
        color: var(--txt-light);
        @include font(light, normal, fs-80);
    }
    .empty {
        color: var(--txt-light);
    }
    table {
        border-collapse: collapse;
        width: 100%;
        @include font(book, normal, fs-80);

        th,
        td {
            text-align: left;
            padding: $sp2 $sp3;
            border-bottom: var(--bw) solid var(--bd);
        }
    }
    .ref {
        font-family: monospace;
    }
    .overdue td {
        color: var(--error);
    }
    .overdue-badge {
        background-color: var(--error);
        color: #ffffff;
        border-radius: toRem(4);
        padding: toRem(1) toRem(6);
        margin-left: $sp3;
        @include font(bold, normal, fs-80);
    }
    .empty {
        color: var(--txt-light);
    }
</style>
