<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { Body, CommonButton2, Container, Form, Input } from "component-lib";
    import { namedAccountsStore, type NamedAccount, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AddressNetworkIcon from "@shared_components/home/wallet/AddressNetworkIcon.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import { toastStore } from "@src/stores/toast";
    import { addressNetwork } from "@src/utils/cryptoAddress";
    import { isRecipientNameTaken, recipientToSave } from "@src/utils/savedRecipient";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        account?: NamedAccount;
    }

    let { onClose, account }: Props = $props();
    let loading = $state(false);
    let name = $state(account?.name ?? "");
    let address = $state(account?.account ?? "");
    let trimmedName = $derived(name.trim());
    let trimmedAddress = $derived(address.trim());
    let nameDirty = $derived(trimmedName !== account?.name);
    // An existing recipient can only be renamed: its address is fixed (see recipientToSave)
    let dirty = $derived(account === undefined || nameDirty);
    // The network the address is for, in the same forms the canister accepts. Saving anything else
    // used to succeed here and then throw out of the worker, unhandled, when the withdrawal mapper
    // tried to decode it.
    let network = $derived(addressNetwork(trimmedAddress));
    let validAddress = $derived(network !== undefined);
    let invalidAddress = $derived(trimmedAddress.length > 0 && !validAddress);
    let validName = $derived(
        trimmedName.length > 0 &&
            !isRecipientNameTaken($namedAccountsStore, trimmedName, account?.account),
    );
    let valid = $derived(validAddress && validName);

    async function addAccount() {
        loading = true;
        const res = await client.saveCryptoAccount(
            recipientToSave(account, trimmedName, trimmedAddress),
        );

        if (res.kind === "success") {
            await client.loadSavedCryptoAccounts();
            loading = false;

            // TODO - we really need to know where we came from
            // if we came from the manage recipient page we just want to pop the stack
            // if we came from the token send success page we want to *clear* the stack
            onClose();
        } else {
            loading = false;
            toastStore.showFailureToast(
                i18nKey("Could not save recipient. Make sure that the address is valid."),
            );
        }
    }

    const titleKey = account !== undefined ? "Edit recipient" : "Add a recipient";
    const descriptionKey =
        account !== undefined
            ? "You are currently editing an existing recipient. Any changes you make cannot be reverted after you save them."
            : "Add a new recipient by entering their crypto address, name, and token tag. We'll automatically try to detect the correct network for the address. You can save and edit it later.";
</script>

<SlidingPageContent title={i18nKey(titleKey)}>
    <Container gap={"xxl"} padding={"lg"} direction={"vertical"}>
        <Container padding={"sm"} gap={"sm"} direction={"vertical"}>
            <Body colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey(descriptionKey)} />
            </Body>
        </Container>
        <Form onSubmit={() => addAccount()}>
            <Container gap={"xxl"} direction={"vertical"}>
                <Input
                    bind:value={name}
                    countdown={false}
                    maxlength={100}
                    placeholder={interpolate($_, i18nKey("Recipient's name or title"))}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey(
                                "Provide a name or a title for the recipient's address",
                            )} />
                    {/snippet}
                </Input>
                <Input
                    bind:value={address}
                    disabled={account !== undefined}
                    countdown={false}
                    maxlength={200}
                    error={invalidAddress}
                    placeholder={interpolate($_, i18nKey("cryptoAccount.sendTarget"))}>
                    {#snippet icon()}
                        {#if network !== undefined}
                            <AddressNetworkIcon {network} size={"1.5rem"} />
                        {/if}
                    {/snippet}
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey(
                                invalidAddress
                                    ? "addressBook.invalidAddress"
                                    : "Provide an address for your recipient",
                            )} />
                    {/snippet}
                </Input>
            </Container>
        </Form>
        <Container
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            padding={["zero", "lg"]}>
            <CommonButton2 onClick={onClose} variant="primary" mode="text">
                <Translatable resourceKey={i18nKey("cancel")}></Translatable>
            </CommonButton2>
            <CommonButton2
                {loading}
                disabled={!valid || !dirty}
                onClick={addAccount}
                variant="primary"
                mode="small">
                {#snippet icon(color, size)}
                    <Save {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Save recipient")}></Translatable>
            </CommonButton2>
        </Container>
    </Container>
</SlidingPageContent>
