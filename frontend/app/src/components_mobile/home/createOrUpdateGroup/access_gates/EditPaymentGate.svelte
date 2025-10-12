<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { getPaymentGateBindings } from "@src/utils/access";
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
        isCompositeGate,
        isLeafGate,
        isPaymentGate,
        nervousSystemLookup,
        OpenChat,
        publish,
        type AccessGate,
        type CryptocurrencyDetails,
        type PaymentGate,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateGroupState } from "../group.svelte";
    import AboutPaymentGate from "./AboutPaymentGate.svelte";
    import SelectBinding from "./SelectBinding.svelte";

    const client = getContext<OpenChat>("client");
    let ugs = updateGroupState;

    interface Props {
        gate: PaymentGate;
    }

    let { gate }: Props = $props();

    let nsLedgers = $derived(
        new Set([...$nervousSystemLookup.values()].map((d) => d.ledgerCanisterId)),
    );
    let bindings = $derived(getPaymentGateBindings($cryptoLookup, nsLedgers));
    let selectedBinding = $state(initialBinding());
    // svelte-ignore state_referenced_locally
    let amountText = $state(initialPaymentAmount(gate));
    let candidateTokenDetails = $derived(client.getTokenDetailsForAccessGate(selectedBinding.gate));
    let amount = $derived(amountFromText(amountText, candidateTokenDetails));
    let minPayment = $derived((candidateTokenDetails?.transferFee ?? BigInt(0)) * BigInt(100));
    let invalidAmount = $derived(amount === undefined || amount < minPayment);
    let valid = $derived(!(invalidAmount || selectedBinding === undefined));

    function initialPaymentAmount(gate: AccessGate): string {
        if (isPaymentGate(gate)) {
            const token = client.tryGetCryptocurrency(gate.ledgerCanister);
            if (token !== undefined) {
                return client.formatTokens(gate.amount, token.decimals);
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
        const { amount } = client.validateTokenInput(amountText, tokenDetails.decimals);
        return amount;
    }

    function initialBinding() {
        return bindings.find((b) => b.gate.ledgerCanister === gate.ledgerCanister) ?? bindings[0];
    }

    function save() {
        if (amount !== undefined) {
            updateOrAddGate({
                kind: "payment_gate",
                ledgerCanister: selectedBinding?.gate.ledgerCanister ?? "",
                amount,
                fee: selectedBinding?.gate.fee ?? 0n,
            });

            publish("closeModalPage");
        }
    }

    function updateOrAddGate(gate: PaymentGate) {
        if (isCompositeGate(ugs.gateConfig.gate)) {
            const match = ugs.gateConfig.gate.gates.find(
                (g) => g.kind === "payment_gate" && g.ledgerCanister === gate.ledgerCanister,
            );
            if (match && match.kind === "payment_gate") {
                match.amount = gate.amount;
            } else {
                ugs.addLeaf(gate);
            }
        }

        if (isLeafGate(ugs.gateConfig.gate)) {
            if (
                ugs.gateConfig.gate.kind === "payment_gate" &&
                ugs.gateConfig.gate.ledgerCanister === gate.ledgerCanister
            ) {
                ugs.gateConfig.gate.amount = gate.amount;
            } else {
                ugs.addLeaf(gate);
            }
        }
    }

    function updateGate() {
        amountText = "";
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
                            "Choose the token you would like to accept the payment with and the provide the required amount.",
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
                        placeholder={interpolate($_, i18nKey("Amount"))}
                        error={invalidAmount}
                        bind:value={amountText}>
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
                {#snippet icon(color)}
                    <Save {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Save gate")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
