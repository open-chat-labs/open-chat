<!-- Send's recipient sheet (native design notes §3.9 Flows: "recipient sheet"; the prototype's "Send
     to" sheet): a search for people that takes an address too, Paste an address, the saved
     addresses the token can reach (the address book, as the web's Send offers them) and the people
     already DM'd, latest first ("Recent": mobile's and the web's rule, sendContacts). An address
     typed or pasted is taken only where the token can be sent (walletAddressCheck: never the user's
     own wallet, nor a MultiUser user id's account). One fixed height, as a sheet whose content
     changes (notes §1 Sheets). -->
<script lang="ts">
    import { allUsersStore } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { swatchFor } from "@src/logic/swatch";
    import type { Recipient, SendContact } from "@src/logic/wallet/walletFlows";
    import { _ } from "svelte-i18n";
    import { softKeyboard } from "../../aboveKeyboard.svelte";
    import { recipientSheet, shortAddress, type SendTo } from "./flows.adapter";

    type Props = {
        open: boolean;
        /** The token's symbol, for what's said of an address it can't reach. */
        symbol: string;
        contacts: SendContact[];
        /** The saved addresses the token can reach. */
        saved: Recipient[];
        takesAddress: (address: string) => boolean;
        /** Who it goes to now, marked. */
        selected: SendTo | undefined;
        onPick: (to: SendTo) => void;
        /** Something to say (translated): a pasted address the token can't reach. */
        onRefused: (message: string) => void;
        onClose: () => void;
    };

    let { open, symbol, contacts, saved, takesAddress, selected, onPick, onRefused, onClose }: Props =
        $props();

    let query = $state("");
    const sheet = $derived(recipientSheet(query, contacts, saved, takesAddress));

    $effect(() => {
        if (!open) query = "";
    });

    const short = shortAddress;

    async function paste() {
        let text = "";
        try {
            text = (await navigator.clipboard.readText()).trim();
        } catch {
            // no clipboard to read: the search takes a pasted address too
        }
        if (text !== "" && takesAddress(text)) {
            onPick({ kind: "address", address: text });
        } else {
            onRefused($_("native.walletFlows.notAnAddress", { values: { symbol } }));
        }
    }

    const savedTo = (r: Recipient): SendTo => ({ kind: "address", address: r.address, name: r.name });
    const personTo = (p: SendContact): SendTo => ({
        kind: "person",
        userId: p.userId,
        name: p.name,
        handle: p.handle,
    });

    const isSelected = (to: SendTo) =>
        selected !== undefined &&
        (selected.kind === "person"
            ? to.kind === "person" && to.userId === selected.userId
            : to.kind === "address" && to.address === selected.address);
</script>

{#snippet search()}
    <div class="search">
        <Field
            placeholder={$_("native.walletFlows.searchRecipient")}
            value={query}
            onInput={(e) => (query = e.currentTarget.value)}
            onClear={() => (query = "")}
            showShortcut={false} />
    </div>
{/snippet}

<BottomSheet
    {open}
    {onClose}
    title={$_("native.walletFlows.sendTo")}
    height="82%"
    keyboard={softKeyboard.covering}
    header={search}>
    <div class="list">
        {#if sheet.address !== undefined}
            {@const address = sheet.address}
            <button type="button" class="row" onclick={() => onPick({ kind: "address", address })}>
                <span class="circle"><span class="icon" style:--icon="var(--icon-wallet)"></span></span>
                <span class="text">
                    <span class="title">{$_("native.walletFlows.sendToAddress")}</span>
                    <span class="sub mono">{short(address)}</span>
                </span>
            </button>
        {:else}
            <button type="button" class="row" onclick={paste}>
                <span class="circle"><span class="icon" style:--icon="var(--icon-copy)"></span></span>
                <span class="text">
                    <span class="title">{$_("native.walletFlows.pasteAddress")}</span>
                    <span class="sub">{$_("native.walletFlows.pasteAddressSub")}</span>
                </span>
            </button>
        {/if}

        {#if sheet.saved.length > 0}
            <div class="label"><ListSectionLabel label={$_("native.walletFlows.saved")} /></div>
            {#each sheet.saved as r (r.id)}
                {@const to = savedTo(r)}
                <button type="button" class="row" class:selected={isSelected(to)} onclick={() => onPick(to)}>
                    <span class="circle"><span class="icon" style:--icon="var(--icon-wallet)"></span></span>
                    <span class="text">
                        <span class="title">{r.name}</span>
                        <span class="sub mono">{short(r.address)}</span>
                    </span>
                </button>
            {/each}
        {/if}

        {#if sheet.people.length > 0}
            <div class="label"><ListSectionLabel label={$_("native.walletFlows.recent")} /></div>
            {#each sheet.people as p (p.userId)}
                {@const to = personTo(p)}
                <button type="button" class="row" class:selected={isSelected(to)} onclick={() => onPick(to)}>
                    <Avatar size={40} color={swatchFor(p.userId)} url={$allUsersStore.get(p.userId)?.blobUrl} />
                    <span class="text">
                        <span class="title">{p.name}</span>
                        <span class="sub mono">{p.handle}</span>
                    </span>
                </button>
            {/each}
        {:else if query.trim() !== "" && sheet.address === undefined && sheet.saved.length === 0}
            <p class="none">{$_("native.walletFlows.noRecipients")}</p>
        {/if}
    </div>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .search {
        padding: 0 var(--space-16) var(--space-10);
    }

    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 0 var(--space-16) var(--scroll-end);
    }

    .label {
        padding: var(--space-16) 0 0 var(--space-4);
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: var(--space-8) var(--space-12);
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active,
        &.selected {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .circle {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--overlay-2);
        @include flex-center;
    }

    .icon {
        width: 18px;
        height: 18px;
        background: var(--ink-2);
        mask: var(--icon) center / contain no-repeat;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .title {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .sub {
        font: var(--weight-regular) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
        @include truncate;

        &.mono {
            font-family: var(--font-mono);
            font-weight: var(--weight-medium);
        }
    }

    .none {
        margin: 0;
        padding: var(--space-24) var(--space-8);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }
</style>
