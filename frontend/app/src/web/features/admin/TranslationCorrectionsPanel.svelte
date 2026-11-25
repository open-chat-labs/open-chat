<!-- The operator console's Translation Corrections tab (the old `ReviewTranslationCorrections`):
     the translators' CHAT balance, and the corrections users proposed, one row each with a menu to
     preview it (in place of the English, for layout), show it in English, approve it, or reject
     it for its meaning or its length. TODO(design): no design; a plain table and the library's
     menu. -->
<script lang="ts">
    import { formatTokens, type TranslationCorrection } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ContextMenu from "@openchat/ui/src/lib/components/ContextMenu.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import type { MenuItem } from "@openchat/ui/src/lib/types";
    import type { TranslationCorrections } from "@src/logic/admin/translationCorrections.svelte";
    import { onMount } from "svelte";
    import type { ConsoleReport } from "./console";

    interface Props {
        corrections: TranslationCorrections;
        userName: (userId: string) => string;
        /** A key's text in a locale. */
        textIn: (key: string, locale: string) => string;
        proposedAt: (correction: TranslationCorrection) => string;
        onPreview: (correction: TranslationCorrection) => void;
        onReport: ConsoleReport;
    }

    let { corrections, userName, textIn, proposedAt, onPreview, onReport }: Props = $props();

    onMount(() => {
        void corrections.load();
        void corrections.refreshBalance();
    });

    const balance = $derived(formatTokens(corrections.chatBalance, 8));

    type Anchor = { left: number; right: number; top: number; bottom: number };
    let menu = $state<{ correction: TranslationCorrection; anchor: Anchor } | undefined>();
    const menuButtons: Record<string, HTMLElement | undefined> = $state({});

    function openMenu(correction: TranslationCorrection) {
        const r = menuButtons[String(correction.id)]?.getBoundingClientRect();
        if (r === undefined) return;
        menu = {
            correction,
            anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
        };
    }

    const menuItems = $derived.by((): MenuItem[] => {
        if (menu === undefined) return [];
        const correction = menu.correction;
        const close = (run: () => void) => () => {
            menu = undefined;
            run();
        };
        return [
            { id: "preview", label: "Preview", icon: "eye", onSelect: close(() => onPreview(correction)) },
            corrections.isVerifying(correction)
                ? {
                      id: "proposed",
                      label: "Show proposed",
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
                onSelect: close(async () => onReport(await failureOnly(corrections.approve(correction)))),
            },
            {
                id: "reject-meaning",
                label: "Reject (meaning)",
                icon: "close",
                variant: "danger",
                onSelect: close(async () =>
                    onReport(await failureOnly(corrections.reject(correction, "incorrect_meaning"))),
                ),
            },
            {
                id: "reject-layout",
                label: "Reject (layout)",
                icon: "close",
                variant: "danger",
                onSelect: close(async () =>
                    onReport(await failureOnly(corrections.reject(correction, "too_long"))),
                ),
            },
        ];
    });

    // A correction approved or rejected leaves the list, which is all it says (as the old one)
    async function failureOnly(
        pending: ReturnType<TranslationCorrections["approve"]>,
    ): Promise<Parameters<ConsoleReport>[0]> {
        const outcome = await pending;
        return outcome.kind === "failed" ? outcome : undefined;
    }
</script>

<div class="corrections">
    <div class="balance">
        <span class="admin-label">CHAT balance</span>
        <span class="amount">{balance}</span>
        <Button
            label=""
            icon="refresh"
            ariaLabel="Refresh"
            variant="ghost"
            busy={corrections.refreshing}
            onClick={() => void corrections.refreshBalance()} />
    </div>

    <div class="scroller">
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Locale</th>
                    <th>Key</th>
                    <th>English value</th>
                    <th>Current value</th>
                    <th>Suggested value</th>
                    <th>Proposed by</th>
                    <th>Proposed at</th>
                    <th class="action"></th>
                </tr>
            </thead>
            <tbody>
                {#each corrections.corrections as correction (correction.id)}
                    <tr>
                        <td>{correction.locale}</td>
                        <td class="admin-mono key">{correction.key}</td>
                        <td>{textIn(correction.key, "en-GB")}</td>
                        <td>{textIn(correction.key, correction.locale)}</td>
                        <td>{corrections.proposedValue(correction)}</td>
                        <td>{userName(correction.proposedBy)}</td>
                        <td>{proposedAt(correction)}</td>
                        <td class="action">
                            {#if corrections.processing.has(correction.id)}
                                <Spinner size={20} />
                            {:else}
                                <span bind:this={menuButtons[String(correction.id)]}>
                                    <IconButton
                                        icon="more"
                                        variant="ghost"
                                        label="More options"
                                        onClick={() => openMenu(correction)} />
                                </span>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<ContextMenu
    open={menu !== undefined}
    items={menuItems}
    anchor={menu?.anchor ?? null}
    align="end"
    onClose={() => (menu = undefined)} />

<style lang="scss">
    .corrections {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .balance {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-8);
    }

    .amount {
        font: var(--weight-bold) var(--text-base) / 1.3 var(--font-sans);
        color: var(--ink);
    }

    .scroller {
        overflow-x: auto;
    }

    .admin-table {
        min-width: 760px;
    }

    .key {
        overflow-wrap: anywhere;
    }

    .action {
        width: 40px;
    }
</style>
