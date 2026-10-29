<!-- Send's saved-address picker (6d): the address book's entries the token being sent can reach, as
     the old Send offers them (#10013); one picked fills Send's address. -->
<script lang="ts">
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import MemberRow from "@openchat/ui/src/lib/components/MemberRow.svelte";
    import type { Recipient } from "@openchat/ui/src/features/components/WalletRecipients.svelte";
    import { _ } from "svelte-i18n";
    import { swatchFor } from "../chats/chatList.adapter";

    interface Props {
        /** The saved recipients the token can be sent to. */
        recipients: Recipient[];
        /** Whether any address is saved at all, for what an empty list says. */
        anySaved: boolean;
        symbol: string;
        onPick: (address: string) => void;
        onClose: () => void;
    }

    let { recipients, anySaved, symbol, onPick, onClose }: Props = $props();

    const short = (a: string): string => (a.length > 26 ? `${a.slice(0, 12)}…${a.slice(-8)}` : a);

    // by name or address
    let query = $state("");
    const needle = $derived(query.trim().toLowerCase());
    const shown = $derived(
        needle === ""
            ? recipients
            : recipients.filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(needle)),
    );
</script>

<!-- TODO(design): no saved-address picker in the design (GAPS.md); built from DialogShell and MemberRow -->
<DialogShell title={$_("addressBook.title")} width={440} height="auto" flush {onClose}>
    {#if recipients.length === 0}
        <div class="empty">
            <EmptyState
                preset="no-results"
                title={anySaved
                    ? $_("addressBook.noneForToken", { values: { token: symbol } })
                    : ""}
                body={anySaved ? "" : $_("addressBook.empty")}
                actionLabel="" />
        </div>
    {:else}
        <div class="top">
            <Field
                placeholder="ui.walletRecipients.searchPlaceholder"
                value={query}
                onInput={(e) => (query = e.currentTarget.value)}
                onClear={() => (query = "")}
                showShortcut={false} />
        </div>
        <div class="list">
            {#each shown as r (r.id)}
                <MemberRow
                    title={r.name}
                    subtitle={short(r.address)}
                    tag={r.networkName ?? ""}
                    color={swatchFor(r.address)}
                    showMenu={false}
                    onClick={() => onPick(r.address)} />
            {/each}
            {#if shown.length === 0}
                <EmptyState
                    preset="no-results"
                    title="ui.walletRecipients.noMatches"
                    actionLabel="" />
            {/if}
        </div>
    {/if}
</DialogShell>

<style>
    .top {
        padding: var(--space-16) var(--space-16) var(--space-8);
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: min(420px, 60vh);
        overflow-y: auto;
        padding: var(--space-4) var(--space-10) var(--space-16);
    }

    .empty {
        padding: var(--space-24) var(--space-16);
    }
</style>
