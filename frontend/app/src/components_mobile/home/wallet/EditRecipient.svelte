<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { BodySmall, CommonButton, Container, Form, Input } from "component-lib";
    import { namedAccountsStore, type NamedAccount, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        account?: NamedAccount;
    }

    let { onClose, account = $bindable() }: Props = $props();
    let loading = $state(false);
    let name = $state(account?.name ?? "");
    let address = $state(account?.account ?? "");
    let trimmedName = $derived(name.trim());
    let trimmedAddress = $derived(address.trim());
    let nameDirty = $derived(trimmedName !== account?.name);
    let addressDirty = $derived(trimmedAddress !== account?.account);
    let dirty = $derived(nameDirty || addressDirty);
    let validAddress = $derived(trimmedAddress.length > 0); //todo this probably isn't good enough
    let validName = $derived(
        trimmedName.length > 0 &&
            $namedAccountsStore.find((a) => a.name.toLowerCase() === trimmedName.toLowerCase()) ===
                undefined,
    );
    let valid = $derived(validAddress && validName);

    async function addAccount() {
        loading = true;
        await client.saveCryptoAccount({
            name: trimmedName,
            account: trimmedAddress,
        });
        const accounts = await client.loadSavedCryptoAccounts();
        namedAccountsStore.set(accounts);
        loading = false;
        onClose();
    }
</script>

<SlidingPageContent title={i18nKey("Add a recipient")}>
    <Container gap={"lg"} padding={"lg"} direction={"vertical"}>
        <Container padding={"sm"} gap={"sm"} direction={"vertical"}>
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Add a new recipient by entering their crypto address, name, and token tag. We’ll automatically try to detect the correct network for the address. You can save and edit it later.",
                    )} />
            </BodySmall>
        </Container>
        <Form onSubmit={() => addAccount()}>
            <Container gap={"xxl"} direction={"vertical"}>
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
            </Container>
        </Form>
        <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <CommonButton onClick={onClose} size={"small_text"}>
                <Translatable resourceKey={i18nKey("cancel")}></Translatable>
            </CommonButton>
            <CommonButton
                {loading}
                disabled={!valid || !dirty}
                onClick={addAccount}
                mode={"active"}
                size={"medium"}>
                {#snippet icon(color)}
                    <Save {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Save recipient")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
