<!-- Translations: the translators' CHAT balance (with Refresh) over the corrections users
     suggested, a table with a menu on each row to preview the suggestion (in place of the English,
     for layout), show it in English, approve it, or reject it for its meaning or its length. A
     correction approved or rejected leaves the list, which is all it says; a failure is a toast. -->
<script lang="ts">
    import {
        allUsersStore,
        formatTokens,
        type OpenChat,
        type TranslationCorrection,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ContextMenu from "@openchat/ui/src/lib/components/ContextMenu.svelte";
    import DataTable from "@openchat/ui/src/lib/components/DataTable.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import type { MenuItem } from "@openchat/ui/src/lib/types";
    import { toastStore } from "@src/stores/toast";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
    }

    let { admin }: Props = $props();

    const client = getContext<OpenChat>("client");
    const corrections = $derived(admin.corrections);

    onMount(() => {
        void corrections.load();
        void corrections.refreshBalance();
    });

    const balance = $derived(formatTokens(corrections.chatBalance, 8));
    const tableState = $derived(
        corrections.status === "loading"
            ? "loading"
            : corrections.status === "failed"
              ? "error"
              : corrections.corrections.length === 0
                ? "empty"
                : "ready",
    );

    const COLUMNS = [
        { key: "locale", label: "Locale", width: "64px" },
        { key: "key", label: "Key", width: "18%" },
        { key: "english", label: "English value" },
        { key: "current", label: "Current value" },
        { key: "suggested", label: "Suggested value" },
        { key: "proposed", label: "Proposed", width: "130px" },
        { key: "action", label: "", width: "48px" },
    ];

    // the current value and English of a key, in a locale (the corrections' own columns)
    const textIn = $derived((key: string, inLocale: string): string =>
        $_(key, { locale: inLocale }),
    );
    const userName = (userId: string): string => $allUsersStore.get(userId)?.username ?? userId;
    const proposedAt = (c: TranslationCorrection): string =>
        client.toDatetimeString(new Date(Number(c.proposedAt)));

    type Anchor = { left: number; right: number; top: number; bottom: number };
    let menu = $state<{ correction: TranslationCorrection; anchor: Anchor } | undefined>();
    const menuButtons: Record<string, HTMLElement | undefined> = $state({});

    function openMenu(correction: TranslationCorrection): void {
        const r = menuButtons[String(correction.id)]?.getBoundingClientRect();
        if (r === undefined) return;
        menu = {
            correction,
            anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
        };
    }

    async function failureToast(pending: ReturnType<typeof corrections.approve>): Promise<void> {
        const outcome = await pending;
        if (outcome.kind === "failed") toastStore.showFailureToast(outcome.message);
    }

    const menuItems = $derived.by((): MenuItem[] => {
        if (menu === undefined) return [];
        const correction = menu.correction;
        const close = (run: () => void) => () => {
            menu = undefined;
            run();
        };
        return [
            {
                id: "preview",
                label: "Preview",
                icon: "eye",
                onSelect: close(() =>
                    client.previewTranslationCorrection(correction.key, correction.value),
                ),
            },
            corrections.isVerifying(correction)
                ? {
                      id: "proposed",
                      label: "Show suggestion",
                      icon: "lang",
                      onSelect: close(() => corrections.showProposed()),
                  }
                : {
                      id: "english",
                      label: "Show suggestion in English",
                      icon: "lang",
                      onSelect: close(() => void corrections.verify(correction)),
                  },
            {
                id: "approve",
                label: "Approve",
                icon: "check",
                onSelect: close(() => void failureToast(corrections.approve(correction))),
            },
            {
                id: "reject-meaning",
                label: "Reject (meaning)",
                icon: "close",
                variant: "danger",
                onSelect: close(
                    () => void failureToast(corrections.reject(correction, "incorrect_meaning")),
                ),
            },
            {
                id: "reject-layout",
                label: "Reject (too long)",
                icon: "close",
                variant: "danger",
                onSelect: close(
                    () => void failureToast(corrections.reject(correction, "too_long")),
                ),
            },
        ];
    });
</script>

<div class="balance">
    <span class="tile" aria-hidden="true"></span>
    <div class="value">
        <span class="label">CHAT balance</span>
        <b class="amount">{balance}<small>CHAT</small></b>
    </div>
    <Button
        label="Refresh"
        icon="refresh"
        variant="secondary"
        busy={corrections.refreshing}
        disabled={corrections.refreshing}
        onClick={() => void corrections.refreshBalance()} />
</div>

<DataTable
    title="Suggested translations"
    count={corrections.corrections.length}
    columns={COLUMNS}
    rows={corrections.corrections}
    rowKey={(c: TranslationCorrection) => String(c.id)}
    rowTone={(c: TranslationCorrection) => (corrections.processing.has(c.id) ? "busy" : "default")}
    state={tableState}
    emptyTitle="Nothing to review"
    emptyBody="Translations users suggest show up here."
    errorTitle="Couldn’t load the suggestions"
    onRetry={() => void corrections.load()}
    minWidth={760}
    maxHeight="560px">
    {#snippet cell(c: TranslationCorrection, key: string)}
        {#if key === "locale"}
            <span class="mono">{c.locale}</span>
        {:else if key === "key"}
            <span class="mono key">{c.key}</span>
        {:else if key === "english"}
            {textIn(c.key, "en-GB")}
        {:else if key === "current"}
            {textIn(c.key, c.locale)}
        {:else if key === "suggested"}
            <span class="suggested">{corrections.proposedValue(c)}</span>
        {:else if key === "proposed"}
            <span class="proposed">
                <span>{userName(c.proposedBy)}</span>
                <span class="when">{proposedAt(c)}</span>
            </span>
        {:else if key === "action"}
            {#if corrections.processing.has(c.id)}
                <Spinner size={20} />
            {:else}
                <span bind:this={menuButtons[String(c.id)]}>
                    <IconButton
                        icon="more"
                        variant="ghost"
                        label="More options"
                        onClick={() => openMenu(c)} />
                </span>
            {/if}
        {/if}
    {/snippet}
</DataTable>

<ContextMenu
    open={menu !== undefined}
    items={menuItems}
    anchor={menu?.anchor ?? null}
    align="end"
    onClose={() => (menu = undefined)} />

<style lang="scss">
    .balance {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-14) var(--space-18);
        border-radius: var(--radius-lg);
        background: var(--overlay-1);
        box-shadow: inset 0 0 0 1px var(--line-1);
    }

    .tile {
        flex: none;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        background: var(--overlay-2);
        position: relative;

        &::after {
            content: "";
            position: absolute;
            inset: 8px;
            background: var(--ink-2);
            mask: var(--icon-coins) center / contain no-repeat;
        }
    }

    .value {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .label {
        font: var(--weight-medium) var(--text-sm) / 1.2 var(--font-sans);
        color: var(--ink-3);
    }

    .amount {
        font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-mono);
        color: var(--ink);

        small {
            margin-inline-start: var(--space-4);
            font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
            color: var(--ink-3);
        }
    }

    .mono {
        font-family: var(--font-mono);
    }

    .key {
        overflow-wrap: anywhere;
    }

    .suggested {
        color: var(--ink);
        font-weight: var(--weight-medium);
    }

    .proposed {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .when {
        font-size: var(--text-xs);
        color: var(--ink-3);
    }
</style>
