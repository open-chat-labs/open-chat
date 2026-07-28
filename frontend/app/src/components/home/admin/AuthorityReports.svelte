<script lang="ts">
    import type { OpenChat } from "@client";
    import { getContext, onMount } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";

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
    let busyReportIndex = $state<number | undefined>(undefined);
    let error = $state<string | undefined>(undefined);
    let references: Record<number, string> = $state({});

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
                due = register.due ?? [];
                filed = (register.filed ?? []).sort(
                    (a: FiledRow, b: FiledRow) => b.filed_at - a.filed_at,
                );
                loaded = true;
            })
            .catch(() => (error = "Failed to load the register"));
    }

    function recordFiled(row: DueRow) {
        const reference = (references[row.report_index] ?? "").trim();
        if (reference === "" || busyReportIndex !== undefined) return;
        busyReportIndex = row.report_index;
        client
            .recordAuthorityReportFiled(BigInt(row.report_index), reference, row.urgent, false)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("Filing recorded"));
                    load();
                } else {
                    toastStore.showFailureToast(i18nKey("Failed to record the filing"));
                }
            })
            .finally(() => (busyReportIndex = undefined));
    }

    onMount(load);
</script>

<div class="authority-reports">
    <div class="hint">
        Reports due to be filed with the National Crime Agency (CSEA-IRP), and the register of
        filings. File via the portal, then record the reference (URN) here. Urgent cases: phone
        first, portal after.
    </div>

    <h4>Due ({due.length})</h4>
    {#if loaded && due.length === 0}
        <div class="empty">Nothing due</div>
    {/if}
    {#each due as row (row.report_index)}
        <div class="due-row" class:urgent={row.urgent}>
            <div class="row-details">
                <div>
                    Report #{row.report_index}
                    {#if row.urgent}<span class="urgent-badge">URGENT</span>{/if}
                </div>
                <div class="sub">Due since {new Date(row.created).toLocaleString()}</div>
            </div>
            <ButtonGroup align="fill">
                <Input
                    placeholder={i18nKey("Portal reference (URN)")}
                    bind:value={
                        () => references[row.report_index] ?? "",
                        (v) => (references[row.report_index] = v)
                    }
                />
                <Button
                    tiny
                    disabled={busyReportIndex !== undefined ||
                        (references[row.report_index] ?? "").trim() === ""}
                    loading={busyReportIndex === row.report_index}
                    onClick={() => recordFiled(row)}
                >
                    Record filing
                </Button>
            </ButtonGroup>
        </div>
    {/each}

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
                            {#if row.urgent}urgent{/if}
                            {#if row.unverified}unverified{/if}
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
    .due-row {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        padding: $sp3;
        border: var(--bw) solid var(--bd);
        border-radius: $sp2;

        &.urgent {
            border-color: var(--error);
        }
    }
    .row-details .sub {
        color: var(--txt-light);
        @include font(light, normal, fs-80);
    }
    .urgent-badge {
        background-color: var(--error);
        color: #ffffff;
        border-radius: toRem(4);
        padding: toRem(1) toRem(6);
        margin-left: $sp3;
        @include font(bold, normal, fs-80);
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
</style>
