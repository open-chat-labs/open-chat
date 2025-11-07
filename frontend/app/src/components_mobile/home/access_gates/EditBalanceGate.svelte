<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { getBalanceGateBindings } from "@src/utils/access";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        Form,
        Input,
    } from "component-lib";
    import {
        cryptoLookup,
        isBalanceGate,
        OpenChat,
        publish,
        type AccessGate,
        type CryptocurrencyDetails,
        type TokenBalanceGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AboutPaymentGate from "./AboutPaymentGate.svelte";
    import SelectBinding from "./SelectBinding.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: TokenBalanceGate;
        data: UpdateGroupOrCommunityState;
    }

    let { gate, data }: Props = $props();

    let bindings = $derived(getBalanceGateBindings($cryptoLookup));
    let selectedBinding = $state(initialBinding());
    // svelte-ignore state_referenced_locally
    let minBalanceText = $state(initialMinBalance(gate));
    let candidateTokenDetails = $derived(client.getTokenDetailsForAccessGate(selectedBinding.gate));
    let minBalance = $derived(amountFromText(minBalanceText, candidateTokenDetails));
    let minPayment = $derived((candidateTokenDetails?.transferFee ?? BigInt(0)) * BigInt(100));
    let invalidMinBalance = $derived(minBalance === undefined || minBalance < minPayment);

    let valid = $derived(!(invalidMinBalance || selectedBinding === undefined));

    function initialMinBalance(gate: AccessGate): string {
        if (isBalanceGate(gate)) {
            const token = client.tryGetCryptocurrency(gate.ledgerCanister);
            if (token !== undefined) {
                return client.formatTokens(gate.minBalance, token.decimals);
            }
        }
        return "";
    }

    function amountFromText(
        amountText: string,
        tokenDetails: CryptocurrencyDetails | undefined,
    ): bigint | undefined {
        if (tokenDetails === undefined) {
            return undefined;
        }
        return client.validateTokenInput(amountText, tokenDetails.decimals).amount;
    }

    function initialBinding() {
        return bindings.find((b) => b.gate.ledgerCanister === gate.ledgerCanister) ?? bindings[0];
    }

    function save() {
        if (minBalance !== undefined && selectedBinding !== undefined) {
            updateOrAddGate({
                ...selectedBinding.gate,
                ledgerCanister: selectedBinding.gate.ledgerCanister ?? "",
                minBalance,
            });

            publish("closeModalPage");
        }
    }

    function updateOrAddGate(gate: TokenBalanceGate) {
        const match = data.findMatch(gate);
        if (match === undefined) {
            data.addLeaf(gate);
        } else if (isBalanceGate(match)) {
            match.minBalance = gate.minBalance;
        }
    }

    function updateGate() {
        minBalanceText = "";
    }
</script>

<SlidingPageContent title={i18nKey("Provide gate values")}>
    <Container height={{ kind: "fill" }} gap={"lg"} direction={"vertical"} padding={["xl", "lg"]}>
        <AboutPaymentGate padding={"lg"} background={ColourVars.background1} />

        <Container gap={"xl"} direction={"vertical"}>
            <Container gap={"sm"} direction={"vertical"} padding={["zero", "sm"]}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Gate values")}></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Choose the token you would like to verify against minimum balance, and when that minimum balance should be.",
                        )}></Translatable>
                </BodySmall>
            </Container>

            <Form onSubmit={save}>
                <Container direction={"vertical"} gap={"xl"}>
                    <SelectBinding
                        {bindings}
                        onSelect={updateGate}
                        title={"Choose token"}
                        bind:selectedBinding
                        placeholder={"Choose one of the available tokens"}>
                    </SelectBinding>

                    <Input
                        maxlength={100}
                        placeholder={interpolate($_, i18nKey("Minimum balance"))}
                        error={invalidMinBalance}
                        bind:value={minBalanceText}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("This value is required")}
                            ></Translatable>
                        {/snippet}
                    </Input>
                </Container>
            </Form>
        </Container>

        <Container mainAxisAlignment={"end"} crossAxisAlignment={"center"}>
            <CommonButton disabled={!valid} onClick={save} mode={"active"} size={"medium"}>
                {#snippet icon(color, size)}
                    <Save {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Save gate")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
