<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, ICP_TRANSFER_FEE, ICP_TRANSFER_FEE_E8S } from "../../domain/user/user";
    import Input from "../Input.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import AlertOutline from "svelte-material-icons/AlertOutline.svelte";
    import Legend from "../Legend.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { apiKey } from "../../services/serviceContainer";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import type { CreatedUser } from "../../domain/user/user";
    import { now } from "../../stores/time";
    import { userStore } from "../../stores/user";
    import { currentUserKey } from "../../fsm/home.controller";
    import { rollbar } from "../../utils/logging";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import { iconSize } from "../../stores/iconSize";
    import { icpBalanceE8sStore, icpBalanceStore } from "../../stores/balance";
    import { formatICPs, validateInput } from "../../utils/cryptoFormatter";
    const dispatch = createEventDispatcher();

    export let open: boolean;
    export let receiverId: string;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let refreshing = false;
    let error: string | undefined = undefined;
    let draftAmountE8s: bigint = BigInt(0);
    let draftAmountString = "0";
    let message = "";
    let confirming = false;

    $: remainingBalanceE8s =
        draftAmountE8s > BigInt(0)
            ? $icpBalanceE8sStore.e8s - draftAmountE8s - ICP_TRANSFER_FEE_E8S
            : $icpBalanceE8sStore.e8s;
    $: valid = error === undefined && draftAmountE8s > BigInt(0);
    $: receiver = $userStore[receiverId];
    $: mobile = $screenWidth === ScreenWidth.ExtraSmall;

    $: {
        let [validatedString, amountE8s] = validateInput(draftAmountString, 8);

        let amountChanged = false;
        if (amountE8s > $icpBalanceE8sStore.e8s - ICP_TRANSFER_FEE_E8S) {
            amountE8s = $icpBalanceE8sStore.e8s - ICP_TRANSFER_FEE_E8S;
            amountChanged = true;
        }
        if (amountE8s < BigInt(0)) {
            amountE8s = BigInt(0);
            amountChanged = true;
        }
        draftAmountString = amountChanged ? formatICPs(amountE8s, 0) : validatedString;
        draftAmountE8s = amountE8s;
    }

    export function reset() {
        refreshing = true;
        error = undefined;
        const previousDraftAmountString = draftAmountString;
        draftAmountString = "0";
        confirming = false;
        message = "";
        api.refreshAccountBalance(user.icpAccount)
            .then((b) => {
                draftAmountString = previousDraftAmountString;
                error = undefined;
            })
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                rollbar.error("Unable to refresh user's account balance", err);
            })
            .finally(() => (refreshing = false));
    }

    function onInput(ev: InputEvent) {
        draftAmountString = ev.target.value;
    }

    function send() {
        if (!confirming) {
            confirming = true;
            return;
        }
        const content = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                transferKind: "icp_transfer",
                kind: "pending_icp_transfer",
                recipient: receiverId,
                amountE8s: draftAmountE8s,
            },
        };
        dispatch("sendTransfer", content);
        open = false;
    }
</script>

<Overlay dismissible={true} bind:active={open}>
    <ModalContent fill={confirming}>
        <span class="header" slot="header">
            <div class="left">
                <span class="avatar">
                    <Avatar
                        url={avatarUrl(receiver)}
                        status={getUserStatus($now, $userStore, receiverId)}
                        size={AvatarSize.Small} />
                </span>
                <div class="main-title">
                    {$_("icpTransfer.title")}
                </div>
            </div>
            <div class="balance">
                <div class="amount">{formatICPs(remainingBalanceE8s, 4)}</div>
                <div class="label">
                    {draftAmountE8s > BigInt(0)
                        ? $_("icpAccount.shortRemainingBalanceLabel")
                        : $_("icpAccount.shortBalanceLabel")}
                </div>
            </div>
            <div class="refresh" class:refreshing class:mobile on:click={reset}>
                <Refresh size={"1em"} color={"var(--accent)"} />
            </div>
        </span>
        <form slot="body">
            <div class="body" class:confirming>
                {#if confirming}
                    <div class="alert">
                        <AlertOutline size={$iconSize} color={"var(--toast-failure-txt"} />
                    </div>
                    <div class="alert-txt">
                        {$_("icpTransfer.warning")}
                    </div>
                {:else}
                    <div class="transfer">
                        <Legend>{$_("icpTransfer.amount")}</Legend>
                        <input
                            autofocus={true}
                            class="amount-val"
                            min={0}
                            max={$icpBalanceStore - ICP_TRANSFER_FEE}
                            type="number"
                            value={draftAmountString}
                            on:input={onInput} />
                    </div>
                    <div class="message">
                        <Legend>{$_("icpTransfer.message")}</Legend>
                        <Input
                            maxlength={100}
                            type={"text"}
                            autofocus={false}
                            countdown={true}
                            placeholder={$_("icpTransfer.messagePlaceholder")}
                            bind:value={message} />
                    </div>
                    <div class="fee">
                        {$_("icpTransfer.fee", { values: { fee: ICP_TRANSFER_FEE.toString() } })}
                    </div>
                    {#if error}
                        <ErrorMessage>{$_(error)}</ErrorMessage>
                    {/if}
                {/if}
            </div>
        </form>
        <span class="footer" slot="footer" class:mobile>
            {#if !mobile}
                <a
                    class="how-to"
                    href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                    target="_blank">
                    {$_("howToBuyICP")}
                </a>
            {/if}
            <ButtonGroup>
                <Button disabled={!valid} tiny={true} on:click={send}
                    >{confirming ? $_("icpTransfer.confirm") : $_("icpTransfer.send")}</Button>
                <Button tiny={true} secondary={true} on:click={() => (open = false)}
                    >{$_("cancel")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .left {
            flex: auto;
            display: flex;
            align-items: center;
            gap: $sp4;

            .main-title {
                flex: auto;
            }
        }

        .balance {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            .amount {
                @include font(bold, normal, fs-100);
            }
            .label {
                @include font(light, normal, fs-70);
            }
        }

        .refresh {
            cursor: pointer;
            height: $sp5;
            width: $sp5;

            &.refreshing {
                @include spin();
            }

            &.mobile {
                height: 21.59px;
                width: 21.59px;
            }
        }
    }

    .body {
        padding: 0 $sp3;
        transition: background-color 100ms ease-in-out;

        &.confirming {
            display: flex;
            gap: $sp4;
            justify-content: space-evenly;
            align-items: center;
            padding: $sp5;
            height: 200px;
            @include font(book, normal, fs-120);
            background-color: var(--toast-failure-bg);
            color: var(--toast-failure-txt);

            .alert {
                flex: 0 0 50px;
            }
        }
    }

    .transfer {
        margin-bottom: $sp4;
    }
    .how-to {
        @include font(light, normal, fs-90);
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
    }

    .amount-val {
        height: 40px;
        @include font(book, normal, fs-140);
        color: var(--input-txt);
        background-color: var(--input-bg);
        border: 1px solid var(--input-bd);
        line-height: 24px;
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-radius: $sp2;
        text-align: right;
        display: block;
        outline: none;
    }

    .footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;

        &.mobile {
            justify-content: center;
        }
    }
    .fee {
        @include font(light, normal, fs-60);
        margin-bottom: $sp3;
        text-transform: lowercase;
    }
</style>
