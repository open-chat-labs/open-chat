<!-- The operator console's Authority reports tab (the old `AuthorityReports`): the register of NCA
     CSEA-IRP filings, those due (oldest first, overdue against our internal SLA targets marked)
     and those filed (newest first). Filings are recorded from the moderation report card, not
     here. TODO(design): no design; plain tables. -->
<script lang="ts">
    import Pill from "@openchat/ui/src/lib/components/Pill.svelte";
    import {
        ageOf,
        filedFlags,
        formatAge,
        isOverdue,
        type AuthorityReports,
    } from "@src/logic/admin/authorityReports.svelte";
    import { onMount } from "svelte";

    interface Props {
        reports: AuthorityReports;
        /** ms, as it passes. */
        now: number;
    }

    let { reports, now }: Props = $props();

    onMount(() => void reports.load());
</script>

<div class="authority-reports">
    <p class="admin-hint">
        The register of authority (NCA CSEA-IRP) filings - the compliance evidence that reporting
        duties were met. Filings are recorded from the moderation report itself.
    </p>

    <h3 class="admin-card-title">Due ({reports.due.length})</h3>
    {#if reports.loaded && reports.due.length === 0}
        <p class="admin-hint">Nothing due</p>
    {/if}
    {#if reports.due.length > 0}
        <p class="admin-hint">
            File from the moderation report card. Ages are measured against our internal SLA targets
            (urgent: 24h, standard: 72h) - the statutory duty is "as soon as reasonably practicable".
        </p>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Report</th>
                    <th>Due since</th>
                    <th>Age</th>
                    <th>Flags</th>
                </tr>
            </thead>
            <tbody>
                {#each reports.due as row (row.report_index)}
                    {@const overdue = isOverdue(row, now)}
                    <tr class:overdue>
                        <td>#{row.report_index}</td>
                        <td>{new Date(row.created).toLocaleString()}</td>
                        <td>
                            <span class="age">
                                {formatAge(ageOf(row, now))}
                                {#if overdue}<Pill label="OVERDUE" tone="danger" />{/if}
                            </span>
                        </td>
                        <td>{row.urgent ? "urgent" : ""}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    <h3 class="admin-card-title">Filed ({reports.filed.length})</h3>
    {#if reports.loaded && reports.filed.length === 0}
        <p class="admin-hint">Nothing filed yet</p>
    {/if}
    {#if reports.filed.length > 0}
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Report</th>
                    <th>Reference</th>
                    <th>Filed</th>
                    <th>Flags</th>
                </tr>
            </thead>
            <tbody>
                {#each reports.filed as row (row.report_index)}
                    <tr>
                        <td>#{row.report_index}</td>
                        <td class="admin-mono">{row.portal_reference}</td>
                        <td>{new Date(row.filed_at).toLocaleString()}</td>
                        <td>{filedFlags(row)}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    {#if reports.error !== undefined}
        <p class="admin-error" role="alert">{reports.error}</p>
    {/if}
</div>

<style lang="scss">
    .authority-reports {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        max-width: 640px;
    }

    .overdue td {
        color: var(--status-danger);
    }

    .age {
        display: inline-flex;
        align-items: center;
        gap: var(--space-8);
    }
</style>
