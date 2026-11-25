<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext, onMount } from "svelte";
    import {
        AuthorityReports,
        ageOf as ageAt,
        filedFlags,
        formatAge,
        isOverdue,
        type DueRow,
    } from "../../../logic/admin/authorityReports.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");
    const register = new AuthorityReports(client);

    let due = $derived(register.due);
    let filed = $derived(register.filed);
    let loaded = $derived(register.loaded);
    let error = $derived(register.error);

    function ageOf(row: DueRow): number {
        return ageAt(row, Date.now());
    }

    function overdue(row: DueRow): boolean {
        return isOverdue(row, Date.now());
    }

    onMount(() => {
        void register.load();
    });
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
                        <td>{filedFlags(row)}</td>
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
