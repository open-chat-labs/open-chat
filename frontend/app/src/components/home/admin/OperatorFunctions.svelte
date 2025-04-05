<script lang="ts">
    import type {
        DiamondMembershipFees,
        OpenChat,
        ResourceKey,
        UpdateMarketMakerConfigArgs,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Input from "../../Input.svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { toastStore } from "../../../stores/toast";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Select from "../../Select.svelte";
    import Toggle from "../../Toggle.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    type Fees = {
        token: "CHAT" | "ICP";
        oneMonth: string;
        threeMonths: string;
        oneYear: string;
        lifetime: string;
    };

    const client = getContext<OpenChat>("client");

    let error: ResourceKey | undefined = $state(undefined);
    let groupUpgradeConcurrency = $state("10");
    let communityUpgradeConcurrency = $state("10");
    let userUpgradeConcurrency = $state("10");
    let busy: Set<number> = $state(new Set());
    let governanceCanisterId = $state("");
    let stake = $state("0");

    let exchangeId: string = $state("");
    let enabled: boolean = $state(true);
    let priceIncrement: string = $state("");
    let orderSize: string = $state("");
    let minOrderSize: string = $state("");
    let maxBuyPrice: string = $state("");
    let minSellPrice: string = $state("");
    let spread: string = $state("");
    let minOrdersPerDirection: string = $state("");
    let maxOrdersPerDirection: string = $state("");
    let maxOrdersToMakePerIteration: string = $state("");
    let maxOrdersToCancelPerIteration: string = $state("");
    let currentFees: Record<"ICP" | "CHAT", Fees> | undefined = $state();
    let originalFees: Record<"ICP" | "CHAT", DiamondMembershipFees>;
    let feesTab: "ICP" | "CHAT" = $state("ICP");
    let tokenLedger = $state("");
    let tokenEnabled = $state(true);

    let groupUpgradeConcurrencyInvalid = $derived(isNaN(parseInt(groupUpgradeConcurrency, 0)));
    let communityUpgradeConcurrencyInvalid = $derived(
        isNaN(parseInt(communityUpgradeConcurrency, 0)),
    );
    let userUpgradeConcurrencyInvalid = $derived(isNaN(parseInt(userUpgradeConcurrency, 0)));
    let exchangeIdInvalid = $derived(isNaN(parseInt(exchangeId, 0)));
    let tokenLedgerValid = $derived(tokenLedger.length > 0);

    onMount(() => {
        client.diamondMembershipFees().then((fees) => {
            originalFees = client.toRecord(fees, (f) => f.token);
            currentFees = client.toRecord2(
                fees,
                (f) => f.token,
                (f) => ({
                    token: f.token,
                    oneMonth: f.oneMonth.toString(),
                    threeMonths: f.threeMonths.toString(),
                    oneYear: f.oneYear.toString(),
                    lifetime: f.lifetime.toString(),
                }),
            );
        });
    });

    function buildMarketMakerConfig(): UpdateMarketMakerConfigArgs | undefined {
        let config;
        if (exchangeIdInvalid) return undefined;

        try {
            config = {
                exchangeId: parseInt(exchangeId, 0),
                enabled: enabled,
                priceIncrement: priceIncrement === "" ? undefined : BigInt(priceIncrement),
                orderSize: orderSize === "" ? undefined : BigInt(orderSize),
                minOrderSize: minOrderSize === "" ? undefined : BigInt(minOrderSize),
                maxBuyPrice: maxBuyPrice === "" ? undefined : BigInt(maxBuyPrice),
                minSellPrice: minSellPrice === "" ? undefined : BigInt(minSellPrice),
                spread: spread === "" ? undefined : BigInt(spread),
                minOrdersPerDirection:
                    minOrdersPerDirection === "" ? undefined : Number(minOrdersPerDirection),
                maxOrdersPerDirection:
                    maxOrdersPerDirection === "" ? undefined : Number(maxOrdersPerDirection),
                maxOrdersToMakePerIteration:
                    maxOrdersToMakePerIteration === ""
                        ? undefined
                        : Number(maxOrdersToMakePerIteration),
                maxOrdersToCancelPerIteration:
                    maxOrdersToCancelPerIteration === ""
                        ? undefined
                        : Number(maxOrdersToCancelPerIteration),
            };
        } catch (err) {
            toastStore.showFailureToast(i18nKey("Failed to create market maker config"), err);
            return undefined;
        }

        return config;
    }

    function addBusy(n: number) {
        busy.add(n);
        busy = busy;
    }

    function removeBusy(n: number) {
        busy.delete(n);
        busy = busy;
    }

    function setGroupUpgradeConcurrency(): void {
        error = undefined;
        addBusy(0);
        client
            .setGroupUpgradeConcurrency(parseInt(groupUpgradeConcurrency, 0))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(`Group upgrade concurrency set to ${groupUpgradeConcurrency}`),
                    );
                } else {
                    error = i18nKey(
                        `Failed to set group upgrade concurrency to ${groupUpgradeConcurrency}`,
                    );
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(0);
            });
    }

    function setCommunityUpgradeConcurrency(): void {
        error = undefined;
        addBusy(1);
        client
            .setCommunityUpgradeConcurrency(parseInt(communityUpgradeConcurrency, 10))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(
                            `Community upgrade concurrency set to ${communityUpgradeConcurrency}`,
                        ),
                    );
                } else {
                    error = i18nKey(
                        `Failed to set community upgrade concurrency to ${communityUpgradeConcurrency}`,
                    );
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(1);
            });
    }

    function setUserUpgradeConcurrency(): void {
        error = undefined;
        addBusy(2);
        client
            .setUserUpgradeConcurrency(parseInt(userUpgradeConcurrency, 10))
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(`User upgrade concurrency set to ${userUpgradeConcurrency}`),
                    );
                } else {
                    error = i18nKey(
                        `Failed to set user upgrade concurrency to ${userUpgradeConcurrency}`,
                    );
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(2);
            });
    }

    function strToBigInt(str: string): bigint | undefined {
        const n = Number(str);
        return isNaN(n) ? undefined : BigInt(n);
    }

    function mapFees(): DiamondMembershipFees[] {
        if (currentFees === undefined) return [];
        const mapped = Object.values(currentFees).reduce((res, val) => {
            res[val.token] = {
                token: val.token,
                oneMonth: strToBigInt(val.oneMonth) ?? res[val.token].oneMonth,
                threeMonths: strToBigInt(val.threeMonths) ?? res[val.token].threeMonths,
                oneYear: strToBigInt(val.oneYear) ?? res[val.token].oneYear,
                lifetime: strToBigInt(val.lifetime) ?? res[val.token].lifetime,
            };
            return res;
        }, originalFees);
        return Object.values(mapped);
    }

    function setDiamondMembershipFees(): void {
        error = undefined;
        addBusy(3);
        const mappedFees = mapFees();
        client
            .setDiamondMembershipFees(mappedFees)
            .then((success) => {
                if (success) {
                    originalFees = client.toRecord(mappedFees, (f) => f.token);
                    toastStore.showSuccessToast(i18nKey(`Diamond membership fees set`));
                } else {
                    error = i18nKey(`Failed to set diamond membership fees`);
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(3);
            });
    }

    function stakeNeuronForSubmittingProposals(): void {
        error = undefined;
        const stakeVal = strToBigInt(stake);
        if (stakeVal !== undefined) {
            addBusy(4);
            client
                .stakeNeuronForSubmittingProposals(governanceCanisterId, stakeVal)
                .then((success) => {
                    if (success) {
                        toastStore.showSuccessToast(i18nKey("Neuron staked successfully"));
                    } else {
                        error = i18nKey("Failed to stake neuron");
                        toastStore.showFailureToast(error);
                    }
                })
                .finally(() => {
                    removeBusy(4);
                });
        }
    }

    function updateMarketMakerConfig(): void {
        error = undefined;
        const config = buildMarketMakerConfig();
        if (config !== undefined) {
            addBusy(5);
            client
                .updateMarketMakerConfig(config)
                .then((resp) => {
                    if (resp === "success") {
                        toastStore.showSuccessToast(i18nKey("Market maker config updated"));
                    } else {
                        error = i18nKey(`Failed to update market maker config: ${resp}`);
                        toastStore.showFailureToast(error);
                    }
                })
                .finally(() => {
                    removeBusy(5);
                });
        }
    }

    function setTokenEnabled(): void {
        error = undefined;
        addBusy(6);
        client
            .setTokenEnabled(tokenLedger, tokenEnabled)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey(`Token enabled set successfully: ${tokenLedger}, ${tokenEnabled}`),
                    );
                } else {
                    error = i18nKey(`Failed to set token enabled: ${tokenLedger}, ${tokenEnabled}`);
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(6);
            });
    }
</script>

<div class="operator">
    <section class="operator-function">
        <div class="title">Set group upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input invalid={groupUpgradeConcurrencyInvalid} bind:value={groupUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(0) || groupUpgradeConcurrencyInvalid}
                loading={busy.has(0)}
                onClick={setGroupUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set community upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input
                invalid={communityUpgradeConcurrencyInvalid}
                bind:value={communityUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(1) || communityUpgradeConcurrencyInvalid}
                loading={busy.has(1)}
                onClick={setCommunityUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set user upgrade concurrency</div>
        <ButtonGroup align="fill">
            <Input invalid={userUpgradeConcurrencyInvalid} bind:value={userUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(2) || userUpgradeConcurrencyInvalid}
                loading={busy.has(2)}
                onClick={setUserUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    {#if currentFees !== undefined}
        <section class="operator-function">
            <div class="title">Set Diamond membership fees</div>
            <div class="name-value">
                <div class="label">Token:</div>
                <div class="value">
                    <Select bind:value={feesTab}>
                        <option value="ICP">ICP</option>
                        <option value="CHAT">CHAT</option>
                    </Select>
                </div>
            </div>
            <div class="name-value">
                <div class="label">One month:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].oneMonth} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Three month:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].threeMonths} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">One year:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].oneYear} />
                </div>
            </div>
            <div class="name-value">
                <div class="label">Lifetime:</div>
                <div class="value">
                    <Input bind:value={currentFees[feesTab].lifetime} />
                </div>
            </div>
            <Button
                tiny
                disabled={busy.has(3)}
                loading={busy.has(3)}
                onClick={setDiamondMembershipFees}>Apply</Button>
        </section>
    {/if}

    <section class="operator-function">
        <div class="title">Stake neuron for submitting proposals</div>
        <div class="name-value">
            <div class="label">Governance Canister Id:</div>
            <div class="value">
                <Input bind:value={governanceCanisterId} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Stake:</div>
            <div class="value">
                <Input bind:value={stake} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(4)}
            loading={busy.has(4)}
            onClick={stakeNeuronForSubmittingProposals}>Apply</Button>
    </section>

    <section class="operator-function">
        <div class="title">Update market maker config</div>
        <div class="name-value">
            <div class="label">Exchange Id:</div>
            <div class="value">
                <Input invalid={exchangeIdInvalid} bind:value={exchangeId} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Enabled:</div>
            <div class="value">
                <Toggle small id="market-maker-enabled" bind:checked={enabled} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Price increment:</div>
            <div class="value">
                <Input bind:value={priceIncrement} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Order size:</div>
            <div class="value">
                <Input bind:value={orderSize} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Min order size:</div>
            <div class="value">
                <Input bind:value={minOrderSize} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max buy price:</div>
            <div class="value">
                <Input bind:value={maxBuyPrice} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Min sell price:</div>
            <div class="value">
                <Input bind:value={minSellPrice} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Spread:</div>
            <div class="value">
                <Input bind:value={spread} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Min orders per direction:</div>
            <div class="value">
                <Input bind:value={minOrdersPerDirection} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max orders per direction:</div>
            <div class="value">
                <Input bind:value={maxOrdersPerDirection} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max orders to make per iteration:</div>
            <div class="value">
                <Input bind:value={maxOrdersToMakePerIteration} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Max orders to cancel per iteration:</div>
            <div class="value">
                <Input bind:value={maxOrdersToCancelPerIteration} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(5) || exchangeIdInvalid}
            loading={busy.has(5)}
            onClick={updateMarketMakerConfig}>Apply</Button>
    </section>

    <section class="operator-function">
        <div class="title">Set token enabled</div>
        <ButtonGroup align="fill">
            <Input invalid={!tokenLedgerValid} bind:value={tokenLedger} />
            <Toggle small id="token-enabled" bind:checked={tokenEnabled} />
            <Button
                tiny
                disabled={busy.has(6) || !tokenLedgerValid}
                loading={busy.has(6)}
                onClick={setTokenEnabled}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <ButtonGroup align="fill">
            <h4>Pause event loop</h4>
            <Button tiny onClick={() => client.pauseEventLoop()}>Pause</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <ButtonGroup align="fill">
            <h4>Resume event loop</h4>
            <Button tiny onClick={() => client.resumeEventLoop()}>Resume</Button>
        </ButtonGroup>
    </section>

    {#if error}
        <ErrorMessage>
            <Translatable resourceKey={error} />
        </ErrorMessage>
    {/if}
</div>

<style lang="scss">
    :global(.operator-function .button-group > :nth-child(2)) {
        flex: 0 0 100px;
        height: 40px;
    }
    :global(.operator-function .button-group > :nth-child(1)) {
        flex: auto;
    }

    .operator {
        flex: auto;
        @include nice-scrollbar();
        padding: $sp4;
        max-width: 600px;
    }

    .operator-function {
        padding: $sp3;
        border: var(--bw) solid var(--bd);
        border-radius: $sp2;
        margin-bottom: $sp5;
    }

    .name-value {
        width: 100%;
        display: flex;
        align-items: center;
        gap: $sp3;

        .label {
            flex: 0 0 150px;
            color: var(--txt-light);
            @include font(light, normal, fs-80);
        }

        .value {
            flex: auto;
        }
    }

    .title {
        margin-bottom: $sp3;
        @include font(bold, normal, fs-100);
    }
</style>
