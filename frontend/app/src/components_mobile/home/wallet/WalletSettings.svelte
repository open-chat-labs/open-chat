<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import type { PinOperation } from "@src/stores/pinNumber";
    import { toastStore } from "@src/stores/toast";
    import {
        Avatar,
        Body,
        Button,
        ColourVars,
        CommonButton,
        Container,
        Input,
        Label,
        Sheet,
        Switch,
    } from "component-lib";
    import {
        cryptoLookup,
        cryptoTokensSorted,
        defaultWalletLedgers,
        OpenChat,
        pinNumberRequiredStore,
        walletConfigStore,
        type EnhancedTokenDetails,
    } from "@client";
    import { WalletSettingsForm } from "@src/logic/wallet/walletSettingsForm.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import Lock from "svelte-material-icons/Lock.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import SetPinNumberModal from "./SetPinNumberModal.svelte";
    import TokenSelector from "./TokenSelector.svelte";

    const client = getContext<OpenChat>("client");

    let showTokenSelector = $state(false);
    // the settings form (logic/wallet), shared with the other trees: edits a copy of the stored
    // config, saved on close only if it differs
    const form = new WalletSettingsForm(
        client,
        () => walletConfigStore.value,
        () => defaultWalletLedgers($cryptoLookup.values()),
    );
    let pinAction = $state<PinOperation>();

    onMount(() => () => void saveOnClose());

    async function saveOnClose(): Promise<void> {
        if ((await form.save()) === "failed") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.configureWalletFailure"));
        }
    }

    function selectToken(token: EnhancedTokenDetails) {
        form.toggleToken(token.ledger);
    }

    function togglePin() {
        const set = !$pinNumberRequiredStore;
        if (set) {
            pinAction = { kind: "set" };
        } else {
            pinAction = { kind: "clear" };
        }
    }
</script>

<SlidingPageContent title={i18nKey("Wallet settings")}>
    <Container height={"fill"} gap={"lg"} padding={"lg"} direction={"vertical"}>
        <Container padding={"sm"} gap={"xxl"} direction={"vertical"}>
            <Container gap={"md"} direction={"vertical"}>
                <Setting
                    toggle={togglePin}
                    info={"Set a PIN number to add an extra layer of security to your wallet. You will be prompted to enter your pin before making any transactions."}>
                    <Switch
                        onChange={togglePin}
                        width={"fill"}
                        reverse
                        bound={false}
                        checked={$pinNumberRequiredStore ?? false}>
                        <Translatable resourceKey={i18nKey("PIN number")} />
                    </Switch>
                </Setting>
                {#if $pinNumberRequiredStore}
                    <Button secondary onClick={() => (pinAction = { kind: "change" })}>
                        {#snippet icon(color)}
                            <Lock {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("Change PIN")} />
                    </Button>
                {/if}
            </Container>
            <Setting
                toggle={() => form.toggleMode()}
                info={[
                    "When enabled, your wallet will be organised automatically, and any token with a non-zero balance, or with dollar value greater than the minimum provided, will be displayed.",
                    "Otherwise, you may configure your wallet manually, by selecting tokens which should appear in the wallet.",
                ]}>
                <Switch
                    onChange={() => form.toggleMode()}
                    width={"fill"}
                    reverse
                    checked={form.config.kind === "auto_wallet"}>
                    <Translatable resourceKey={i18nKey("Automatic configuration")} />
                </Switch>
            </Setting>
        </Container>

        {#if form.config.kind === "auto_wallet"}
            <Input
                error={!form.valid}
                bind:value={form.config.minDollarValue}
                placeholder={interpolate($_, i18nKey("cryptoAccount.minDollarPlaceholder"))}>
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey(
                            "Tokens with dollar value lower than the one provided will be hidden from the wallet",
                        )} />
                {/snippet}
            </Input>
        {:else}
            <Container padding={"sm"} gap={"sm"} direction={"vertical"}>
                <Container>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Selected tokens")} />
                    </Body>
                    <CommonButton
                        mode={"active"}
                        size={"small_text"}
                        onClick={() => (showTokenSelector = true)}>Configure</CommonButton>
                </Container>
                {@const tokens = form.config.tokens}
                {@const selected = $cryptoTokensSorted.filter((a) => tokens.has(a.ledger))}
                <Container wrap gap={"sm"}>
                    {#each selected as token}
                        {@render selectedToken(token)}
                    {/each}
                </Container>
            </Container>
        {/if}

        {#if form.config.kind === "manual_wallet"}
            {#if showTokenSelector}
                <TokenSelector
                    selected={form.config.tokens}
                    onSelect={selectToken}
                    placeholder={i18nKey("Filter tokens...")}
                    onDismiss={() => (showTokenSelector = false)}
                    title={i18nKey("Select tokens to view in wallet")} />
            {/if}
        {/if}
    </Container>
</SlidingPageContent>

{#snippet selectedToken(token: EnhancedTokenDetails)}
    <Container
        supplementalClass={"user_chip"}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
        width={"hug"}
        gap={"md"}
        padding={["xs", "xs", "xs", "xs"]}
        borderColour={ColourVars.primary}
        borderRadius={"circle"}
        borderWidth={"thick"}
        onClick={() => selectToken(token)}>
        <Avatar size={"xs"} url={token.logo}></Avatar>
        <Label colour={"primaryAccent"} width={"hug"}>
            {token.symbol}
        </Label>
        <span class="icon">
            <Close color={ColourVars.primaryAccent} />
        </span>
    </Container>
{/snippet}

{#if pinAction !== undefined}
    <Sheet onDismiss={() => (pinAction = undefined)}>
        <SetPinNumberModal type={pinAction} onClose={() => (pinAction = undefined)} />
    </Sheet>
{/if}

<style lang="scss">
    .icon {
        display: flex;
    }
</style>
