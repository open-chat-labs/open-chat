<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { Body, CommonButton2, Container, Form, Input } from "component-lib";
    import { namedAccountsStore, type NamedAccount, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import { toastStore } from "@src/stores/toast";

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
    let addressDirty = $derived(trimmedAddress !== account?.account);
    let dirty = $derived(nameDirty || addressDirty);
    // TODO this probably isn't good enough
    let validAddress = $derived(trimmedAddress.length > 0);
    let validName = $derived(
        trimmedName.length > 0 &&
            $namedAccountsStore.find((a) => a.name.toLowerCase() === trimmedName.toLowerCase()) ===
                undefined,
    );
    let valid = $derived(validAddress && validName);

    async function addAccount() {
        loading = true;
        const res = await client.saveCryptoAccount({
            name: trimmedName,
            account: trimmedAddress,
        });

        if (res.kind === "success") {
            const accounts = await client.loadSavedCryptoAccounts();
            namedAccountsStore.set(accounts);
            loading = false;

            // TODO - we really need to know where we came from
            // if we came from the manage recipient page we just want to pop the stack
            // if we came from the token send success page we want to *clear* the stack
            onClose();
        } else {
            loading = false;
            toastStore.showFailureToast(
                i18nKey(
                    "Could not save recipient. Make sure that the address is a valid principal.",
                ),
            );
        }
    }

    let titleKey = account !== undefined ? "Edit recipient" : "Add a recipient";
    let descriptionKey =
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
                    countdown={false}
                    maxlength={100}
                    placeholder={interpolate($_, i18nKey("cryptoAccount.sendTarget"))}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey("Provide an address for your recipient")} />
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
