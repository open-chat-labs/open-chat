<script lang="ts">
    import {
        iconSize,
        mobileWidth,
        type NamedAccount,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import AddressNetworkIcon from "@shared_components/home/wallet/AddressNetworkIcon.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import BookAccountOutline from "svelte-material-icons/BookAccountOutline.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import { addressNetwork } from "../../../utils/cryptoAddress";
    import { isRecipientNameTaken } from "../../../utils/savedRecipient";
    import AreYouSure from "../../AreYouSure.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";

    // The canister truncates longer names to this length
    const MAX_NAME_LENGTH = 25;

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    let accounts: NamedAccount[] = $state([]);
    let loading = $state(true);
    let busy = $state(false);
    let adding = $state(false);
    let name = $state("");
    let address = $state("");
    let renaming: NamedAccount | undefined = $state();
    let newName = $state("");
    let deleting: NamedAccount | undefined = $state();

    let trimmedName = $derived(name.trim());
    let trimmedAddress = $derived(address.trim());
    let trimmedNewName = $derived(newName.trim());
    let addressIsUserId = $derived(client.isAccountOfMultiUserCanisterUserId(trimmedAddress));
    // The network the new address is for, in the same forms the canister accepts
    let newAddressNetwork = $derived(addressNetwork(trimmedAddress));
    let addressValid = $derived(!addressIsUserId && newAddressNetwork !== undefined);
    // Saving an address which is already saved would rename it rather than add it
    let alreadySavedAs = $derived(accounts.find((a) => a.account === trimmedAddress)?.name);
    let addNameTaken = $derived(isRecipientNameTaken(accounts, trimmedName));
    let addValid = $derived(
        trimmedName.length > 0 && !addNameTaken && addressValid && alreadySavedAs === undefined,
    );
    let addError: ResourceKey | undefined = $derived.by(() => {
        if (addNameTaken) return i18nKey("addressBook.nameTaken");
        if (addressIsUserId) return i18nKey("cryptoAccount.sendToUserId");
        if (trimmedAddress.length > 0 && newAddressNetwork === undefined)
            return i18nKey("addressBook.invalidAddress");
        if (alreadySavedAs !== undefined)
            return i18nKey("addressBook.alreadySaved", { name: alreadySavedAs });
        return undefined;
    });
    let renameNameTaken = $derived(
        renaming !== undefined && isRecipientNameTaken(accounts, trimmedNewName, renaming.account),
    );
    let renameValid = $derived(trimmedNewName.length > 0 && !renameNameTaken);

    onMount(async () => {
        accounts = await client.loadSavedCryptoAccounts();
        loading = false;
    });

    // Saving an account which is already saved renames it. The list is updated here to match
    // what the canister stores, rather than loaded again.
    async function save(account: NamedAccount): Promise<boolean> {
        busy = true;
        const resp = await client.saveCryptoAccount(account);
        busy = false;
        if (resp.kind !== "success") {
            toastStore.showFailureToast(i18nKey("addressBook.saveFailed"));
            return false;
        }
        accounts = accounts.some((a) => a.account === account.account)
            ? accounts.map((a) => (a.account === account.account ? account : a))
            : [...accounts, account];
        return true;
    }

    function startAdding() {
        if (busy) return;
        renaming = undefined;
        name = "";
        address = "";
        adding = true;
    }

    async function add() {
        if (busy || !addValid) return;
        if (await save({ name: trimmedName, account: trimmedAddress })) {
            adding = false;
        }
    }

    function startRenaming(account: NamedAccount) {
        if (busy) return;
        newName = account.name;
        renaming = account;
    }

    async function rename() {
        if (busy || renaming === undefined || !renameValid) return;
        if (trimmedNewName === renaming.name) {
            renaming = undefined;
            return;
        }
        if (await save({ name: trimmedNewName, account: renaming.account })) {
            renaming = undefined;
        }
    }

    function startDeleting(account: NamedAccount) {
        if (busy) return;
        deleting = account;
    }

    // The canister deletes by name, ignoring case
    function deleteAccount(yes: boolean): Promise<void> {
        const account = deleting;
        deleting = undefined;
        if (!yes || account === undefined) return Promise.resolve();

        busy = true;
        return client
            .deleteCryptoAccount(account.name)
            .then((resp) => {
                if (resp.kind === "success") {
                    const nameLower = account.name.toLowerCase();
                    accounts = accounts.filter((a) => a.name.toLowerCase() !== nameLower);
                } else {
                    toastStore.showFailureToast(i18nKey("addressBook.deleteFailed"));
                }
            })
            .finally(() => (busy = false));
    }
</script>

{#if deleting !== undefined}
    <AreYouSure
        message={i18nKey("addressBook.confirmDelete", { name: deleting.name })}
        action={deleteAccount} />
{/if}

<Overlay {onClose}>
    <ModalContent closeIcon {onClose}>
        {#snippet header()}
            <div class="title">
                <BookAccountOutline size={"1.2em"} color={"var(--txt)"} />
                <Translatable resourceKey={i18nKey("addressBook.title")} />
            </div>
        {/snippet}
        {#snippet body()}
            <div class="body">
                {#if loading}
                    <div class="loading">
                        <FancyLoader />
                    </div>
                {:else if adding}
                    <Legend label={i18nKey("addressBook.name")} />
                    <Input
                        bind:value={name}
                        autofocus
                        maxlength={MAX_NAME_LENGTH}
                        invalid={addNameTaken}
                        placeholder={i18nKey("addressBook.namePlaceholder")} />
                    <Legend label={i18nKey("addressBook.address")} />
                    <div class="address-input">
                        <Input
                            bind:value={address}
                            maxlength={200}
                            invalid={trimmedAddress.length > 0 && !addressValid}
                            placeholder={i18nKey("addressBook.addressPlaceholder")}
                            onEnter={add}>
                            {#if newAddressNetwork !== undefined}
                                <div class="network">
                                    <AddressNetworkIcon network={newAddressNetwork} size={"1.5rem"} />
                                </div>
                            {/if}
                        </Input>
                    </div>
                    {#if addError !== undefined}
                        <ErrorMessage><Translatable resourceKey={addError} /></ErrorMessage>
                    {/if}
                {:else if accounts.length === 0}
                    <p class="empty">
                        <Translatable resourceKey={i18nKey("addressBook.empty")} />
                    </p>
                {:else}
                    {#each accounts as account (account.account)}
                        {@const network = addressNetwork(account.account)}
                        <div class="account">
                            {#if network !== undefined}
                                <AddressNetworkIcon {network} size={"1.5rem"} />
                            {/if}
                            {#if renaming?.account === account.account}
                                <div class="rename">
                                    <Input
                                        bind:value={newName}
                                        autofocus
                                        maxlength={MAX_NAME_LENGTH}
                                        invalid={!renameValid}
                                        placeholder={i18nKey("addressBook.namePlaceholder")}
                                        onEnter={rename} />
                                    <div class="address">{account.account}</div>
                                </div>
                                <HoverIcon
                                    title={$_("save")}
                                    disabled={busy || !renameValid}
                                    onclick={rename}>
                                    <Check size={$iconSize} color={"var(--icon-txt)"} />
                                </HoverIcon>
                                <HoverIcon
                                    title={$_("cancel")}
                                    onclick={() => (renaming = undefined)}>
                                    <Close size={$iconSize} color={"var(--icon-txt)"} />
                                </HoverIcon>
                            {:else}
                                <div class="details">
                                    <div class="name">{account.name}</div>
                                    <div class="address">{account.account}</div>
                                </div>
                                <HoverIcon
                                    title={$_("addressBook.rename")}
                                    disabled={busy}
                                    onclick={() => startRenaming(account)}>
                                    <PencilOutline size={$iconSize} color={"var(--icon-txt)"} />
                                </HoverIcon>
                                <HoverIcon
                                    title={$_("addressBook.delete")}
                                    disabled={busy}
                                    onclick={() => startDeleting(account)}>
                                    <DeleteOutline size={$iconSize} color={"var(--icon-txt)"} />
                                </HoverIcon>
                            {/if}
                        </div>
                        {#if renaming?.account === account.account && renameNameTaken}
                            <ErrorMessage
                                ><Translatable
                                    resourceKey={i18nKey("addressBook.nameTaken")} /></ErrorMessage>
                        {/if}
                    {/each}
                {/if}
            </div>
        {/snippet}
        {#snippet footer()}
            <ButtonGroup>
                {#if adding}
                    <Button
                        secondary
                        onClick={() => (adding = false)}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button
                        disabled={busy || !addValid}
                        loading={busy}
                        onClick={add}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("save")} />
                    </Button>
                {:else}
                    <Button
                        secondary
                        disabled={loading || busy}
                        onClick={startAdding}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("addressBook.add")} />
                    </Button>
                    <Button onClick={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                {/if}
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .title {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .body {
        display: flex;
        flex-direction: column;
        min-height: 100px;
    }

    .loading {
        width: 80px;
        height: 80px;
        margin: auto;
    }

    // Room for the network icon at the end of the input
    .address-input :global(.input-wrapper input) {
        padding-right: 40px;
    }

    .network {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
    }

    .empty {
        @include font(book, normal, fs-90);
        color: var(--txt-light);
    }

    .account {
        display: flex;
        align-items: center;
        gap: $sp2;
        padding: $sp3 0;
        border-bottom: var(--bw) solid var(--bd);

        &:last-of-type {
            border-bottom: none;
        }

        .details,
        .rename {
            flex: auto;
            min-width: 0;
        }

        .rename :global(.input-wrapper) {
            margin-bottom: $sp2;
        }

        .name {
            @include font(medium, normal, fs-100);
            @include ellipsis();
        }

        .address {
            @include font(light, normal, fs-70);
            color: var(--txt-light);
            word-break: break-all;
        }
    }
</style>
