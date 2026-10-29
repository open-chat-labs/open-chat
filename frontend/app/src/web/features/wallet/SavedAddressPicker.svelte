<!-- Send's saved-address picker (6d): the address book's entries the token being sent can reach, as
     the old Send offers them (#10013); one picked fills Send's address. -->
<script lang="ts">
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
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
        <div class="list">
            {#each recipients as r (r.id)}
                <MemberRow
                    title={r.name}
                    subtitle={short(r.address)}
                    tag={r.networkName ?? ""}
                    color={swatchFor(r.address)}
                    showMenu={false}
                    onClick={() => onPick(r.address)} />
            {/each}
        </div>
    {/if}
</DialogShell>

<style>
    .list {
        display: flex;
        flex-direction: column;
        padding: var(--space-8) 0;
    }

    .empty {
        padding: var(--space-24) var(--space-16);
    }
</style>
