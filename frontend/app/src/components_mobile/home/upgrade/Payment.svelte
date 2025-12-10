<script lang="ts">
    import {
        Body,
        Button,
        ColourVars,
        Container,
        Subtitle,
        Switch,
        type MainAxisAlignment,
    } from "component-lib";
    import {
        cryptoLookup,
        E8S_PER_TOKEN,
        publish,
        type DiamondMembershipDuration,
        type DiamondMembershipFees,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import type { RemoteData } from "../../../utils/remoteData";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Loading from "../../Loading.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import Congratulations from "./Congratulations.svelte";
    import Expiry from "./Expiry.svelte";

    interface Props {
        accountBalance?: number;
        error: string | undefined;
        confirming?: boolean;
        confirmed?: boolean;
        refreshingBalance?: boolean;
        ledger: string;
        lifetime?: boolean;
        showExpiry?: boolean;
        onSuccess?: (proof: string) => void;
    }

    let {
        accountBalance = 0,
        error = $bindable(),
        confirming = $bindable(false),
        confirmed = $bindable(false),
        refreshingBalance = $bindable(false),
        ledger,
        lifetime = false,
        showExpiry = true,
        onSuccess,
    }: Props = $props();

    type FeeKey = keyof Omit<DiamondMembershipFees, "token">;
    type FeeData = RemoteData<Record<"ICP" | "CHAT", DiamondMembershipFees>, string>;

    const client = getContext<OpenChat>("client");

    const options: Option[] = [
        {
            index: 0,
            duration: i18nKey("upgrade.oneMonth"),
            fee: "oneMonth",
            enabled: !lifetime,
        },
        {
            index: 1,
            duration: i18nKey("upgrade.threeMonths"),
            fee: "threeMonths",
            enabled: !lifetime,
        },
        {
            index: 2,
            duration: i18nKey("upgrade.oneYear"),
            fee: "oneYear",
            enabled: !lifetime,
        },
        {
            index: 3,
            duration: i18nKey("upgrade.lifetime"),
            fee: "lifetime",
            enabled: true,
        },
    ];

    let autoRenew = $state(true);
    let selectedOption: Option | undefined = $state(options[lifetime ? 3 : 0]);

    type Option = {
        index: number;
        duration: ResourceKey;
        fee: FeeKey;
        enabled: boolean;
    };

    let diamondFees: FeeData = $state({
        kind: "idle",
    });

    const indexToDuration: Record<number, DiamondMembershipDuration> = {
        0: "one_month",
        1: "three_months",
        2: "one_year",
        3: "lifetime",
    };

    function amount(e8s: bigint): number {
        return Number(e8s) / E8S_PER_TOKEN;
    }

    function amountInE8s(symbol: string, fees: FeeData, option: Option | undefined): bigint {
        if (fees.kind !== "success" || option === undefined) {
            return 0n;
        }
        return fees.data[symbol as "ICP" | "CHAT"][option.fee] ?? 0n;
    }

    function confirm() {
        confirming = true;
        client
            .payForDiamondMembership(
                tokenDetails.ledger,
                selectedDuration,
                autoRenew && selectedDuration !== "lifetime",
                toPayE8s,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    confirmed = true;
                    onSuccess?.(resp.proof);
                } else {
                    const errorKey = "upgrade.paymentFailed";
                    error = errorKey;
                    toastStore.showFailureToast(i18nKey(errorKey));
                }
            })
            .finally(() => (confirming = false));
    }

    onMount(() => {
        diamondFees = { kind: "loading" };
        client
            .diamondMembershipFees()
            .then((fees) => {
                diamondFees = {
                    kind: "success",
                    data: client.toRecord(fees, (f) => f.token),
                };
            })
            .catch((err) => {
                diamondFees = { kind: "error", error: err };
            });
    });
    let icpBalance = $derived(accountBalance / E8S_PER_TOKEN); //balance in the user's account expressed as ICP
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let toPayE8s = $derived(amountInE8s(tokenDetails.symbol, diamondFees, selectedOption));
    let toPay = $derived(amount(toPayE8s));
    let insufficientFunds = $derived(toPay - icpBalance > 0.0001); //we need to account for the fact that js cannot do maths
    let selectedDuration = $derived(indexToDuration[selectedOption?.index ?? 0] ?? "one_month");
    let mainAxisAlignment = $derived<MainAxisAlignment>(
        confirmed || confirming ? "center" : "start",
    );
</script>

<Container {mainAxisAlignment} height={"fill"} gap={"lg"} padding={"lg"} direction={"vertical"}>
    {#if confirming}
        <Loading size={"large"} />
    {:else if confirmed}
        <Congratulations />
    {:else}
        {#if showExpiry}
            <Expiry extendBy={selectedDuration} />
        {/if}
        <Container gap={"sm"}>
            <Container gap={"xs"} width={{ share: 2 }} direction={"vertical"}>
                {#each options as option}
                    <Container
                        onClick={() => {
                            if (option.enabled) {
                                selectedOption = option;
                            }
                        }}
                        mainAxisAlignment={"center"}
                        crossAxisAlignment={"center"}
                        background={selectedOption?.index === option.index
                            ? ColourVars.gradient
                            : ColourVars.background1}
                        borderRadius={"md"}
                        padding={"md"}
                        direction={"vertical"}>
                        <Body width={"hug"} uppercase>
                            <Translatable resourceKey={option.duration} />
                        </Body>
                        <Subtitle width={"hug"} fontWeight={"bold"}>
                            {`${amount(amountInE8s(tokenDetails.symbol, diamondFees, option))} ${
                                tokenDetails.symbol
                            }`}
                        </Subtitle>
                    </Container>
                {/each}
            </Container>

            <Container width={{ share: 3 }}>
                <AccountInfo {ledger} />
            </Container>
        </Container>

        {#if !lifetime}
            <Setting
                toggle={() => (autoRenew = !autoRenew)}
                disabled={selectedDuration === "lifetime"}
                info={"upgrade.paymentSmallprint"}>
                <Switch
                    width={"fill"}
                    reverse
                    disabled={selectedDuration === "lifetime"}
                    checked={autoRenew && selectedDuration !== "lifetime"}>
                    <Translatable resourceKey={i18nKey("upgrade.autorenew")} />
                </Switch>
            </Setting>
        {/if}

        {#if insufficientFunds}
            <ErrorMessage
                ><Translatable
                    resourceKey={i18nKey("upgrade.insufficientFunds", {
                        token: tokenDetails.symbol,
                        amount: `${toPay} ${tokenDetails.symbol}`,
                    })} /></ErrorMessage>
        {/if}

        {#if error}
            <ErrorMessage>
                <Translatable resourceKey={i18nKey(error)} />
            </ErrorMessage>
        {/if}
    {/if}
</Container>
<Container padding={"lg"} direction={"vertical"} gap={"sm"}>
    {#if confirmed}<Button onClick={() => publish("closeModalStack")}
            ><Translatable resourceKey={i18nKey("close")} /></Button>
    {:else}
        <Button
            disabled={confirming || insufficientFunds}
            loading={confirming || refreshingBalance}
            onClick={confirm}><Translatable resourceKey={i18nKey("upgrade.confirm")} /></Button>
    {/if}
</Container>
