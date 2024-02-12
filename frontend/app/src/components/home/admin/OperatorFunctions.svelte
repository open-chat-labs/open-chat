<script lang="ts">
    import type { DiamondMembershipFees, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import NumberInput from "../../NumberInput.svelte";
    import Input from "../../Input.svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { toastStore } from "../../../stores/toast";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Select from "../../Select.svelte";
    import Toggle from "../../Toggle.svelte";
    import { i18nKey, type ResourceKey } from "../../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    let error: ResourceKey | undefined = undefined;
    let groupUpgradeConcurrency = 10;
    let communityUpgradeConcurrency = 10;
    let userUpgradeConcurrency = 10;
    let busy: Set<number> = new Set();
    let feeToken = "ICP";
    let oneMonthFees = 0;
    let threeMonthFees = 0;
    let oneYearFees = 0;
    let lifetimeFees = 0;
    let governanceCanisterId = "";
    let stake = 0;

    let exchangeId: number = 0;
    let enabled: boolean = true;
    let priceIncrement: string = "";
    let orderSize: string = "";
    let minOrderSize: string = "";
    let maxBuyPrice: string = "";
    let minSellPrice: string = "";
    let spread: string = "";
    let minOrdersPerDirection: string = "";
    let maxOrdersPerDirection: string = "";
    let maxOrdersToMakePerIteration: string = "";
    let maxOrdersToCancelPerIteration: string = "";

    $: markerMakerConfig = {
        exchangeId: exchangeId,
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
            maxOrdersToMakePerIteration === "" ? undefined : Number(maxOrdersToMakePerIteration),
        maxOrdersToCancelPerIteration:
            maxOrdersToCancelPerIteration === ""
                ? undefined
                : Number(maxOrdersToCancelPerIteration),
    };

    $: fees = {
        token: feeToken,
        oneMonth: BigInt(oneMonthFees),
        threeMonths: BigInt(threeMonthFees),
        oneYear: BigInt(oneYearFees),
        lifetime: BigInt(lifetimeFees),
    } as DiamondMembershipFees;

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
            .setGroupUpgradeConcurrency(groupUpgradeConcurrency)
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
            .setCommunityUpgradeConcurrency(communityUpgradeConcurrency)
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
            .setUserUpgradeConcurrency(userUpgradeConcurrency)
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

    function setDiamondMembershipFees(): void {
        error = undefined;
        addBusy(3);
        client
            .setDiamondMembershipFees([fees])
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey(`Diamond membership fees set ${fees}`));
                } else {
                    error = i18nKey(
                        `Failed to set diamond membership fees ${userUpgradeConcurrency}`,
                    );
                    toastStore.showFailureToast(error);
                }
            })
            .finally(() => {
                removeBusy(3);
            });
    }

    function stakeNeuronForSubmittingProposals(): void {
        error = undefined;
        addBusy(4);
        client
            .stakeNeuronForSubmittingProposals(governanceCanisterId, BigInt(stake))
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

    function updateMarketMakerConfig(): void {
        error = undefined;
        addBusy(5);
        client
            .updateMarketMakerConfig(markerMakerConfig)
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
</script>

<div class="operator">
    <section class="operator-function">
        <div class="title">Set group upgrade concurrency</div>
        <ButtonGroup align="fill">
            <NumberInput bind:value={groupUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(0)}
                loading={busy.has(0)}
                on:click={setGroupUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set community upgrade concurrency</div>
        <ButtonGroup align="fill">
            <NumberInput bind:value={communityUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(1)}
                loading={busy.has(1)}
                on:click={setCommunityUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set user upgrade concurrency</div>
        <ButtonGroup align="fill">
            <NumberInput bind:value={userUpgradeConcurrency} />
            <Button
                tiny
                disabled={busy.has(2)}
                loading={busy.has(2)}
                on:click={setUserUpgradeConcurrency}>Apply</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <div class="title">Set Diamond membership fees</div>
        <div class="name-value">
            <div class="label">Token:</div>
            <div class="value">
                <Select bind:value={feeToken}>
                    <option value="ICP">ICP</option>
                    <option value="CHAT">CHAT</option>
                </Select>
            </div>
        </div>
        <div class="name-value">
            <div class="label">One month:</div>
            <div class="value">
                <NumberInput bind:value={oneMonthFees} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Three month:</div>
            <div class="value">
                <NumberInput bind:value={threeMonthFees} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">One year:</div>
            <div class="value">
                <NumberInput bind:value={oneYearFees} />
            </div>
        </div>
        <div class="name-value">
            <div class="label">Lifetime:</div>
            <div class="value">
                <NumberInput bind:value={lifetimeFees} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(3)}
            loading={busy.has(3)}
            on:click={setDiamondMembershipFees}>Apply</Button>
    </section>

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
                <NumberInput bind:value={stake} />
            </div>
        </div>
        <Button
            tiny
            disabled={busy.has(4)}
            loading={busy.has(4)}
            on:click={stakeNeuronForSubmittingProposals}>Apply</Button>
    </section>

    <section class="operator-function">
        <div class="title">Update market maker config</div>
        <div class="name-value">
            <div class="label">Exchange Id:</div>
            <div class="value">
                <NumberInput bind:value={exchangeId} />
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
        <Button tiny disabled={busy.has(5)} loading={busy.has(5)} on:click={updateMarketMakerConfig}
            >Apply</Button>
    </section>

    <section class="operator-function">
        <ButtonGroup align="fill">
            <h4>Pause event loop</h4>
            <Button tiny on:click={() => client.pauseEventLoop()}>Pause</Button>
        </ButtonGroup>
    </section>

    <section class="operator-function">
        <ButtonGroup align="fill">
            <h4>Resume event loop</h4>
            <Button tiny on:click={() => client.resumeEventLoop()}>Resume</Button>
        </ButtonGroup>
    </section>

    {#if error}
        <ErrorMessage>{error}</ErrorMessage>
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
