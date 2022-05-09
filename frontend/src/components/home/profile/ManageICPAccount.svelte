<script lang="ts">
    import Button from "../../Button.svelte";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import { ICP_TRANSFER_FEE_E8S, CreatedUser } from "../../../domain/user/user";
    import { currentUserKey } from "../../../fsm/home.controller";
    import { formatICP } from "../../../utils/cryptoFormatter";
    import { rollbar } from "../../../utils/logging";
    import AccountInfo from "../AccountInfo.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { toastStore } from "../../../stores/toast";
    import { icpBalanceE8sStore } from "../../../stores/balance";
    import ICPInput from "../ICPInput.svelte";

    export let open: boolean;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let refreshing = false;
    let error: string | undefined = undefined;
    let targetAccount: string = "";
    let amountToWithdrawE8s = BigInt(0);
    let withdrawing = false;

    // make sure that they are not trying to withdraw to the same account - I can see people trying to do that
    $: valid =
        amountToWithdrawE8s > BigInt(0) &&
        targetAccount !== "" &&
        targetAccount !== user.icpAccount;

    $: remainingBalanceE8s =
        amountToWithdrawE8s > BigInt(0)
            ? $icpBalanceE8sStore.e8s - amountToWithdrawE8s - ICP_TRANSFER_FEE_E8S
            : $icpBalanceE8sStore.e8s;

    export function reset() {
        refreshing = true;
        error = undefined;
        api.refreshAccountBalance(user.icpAccount)
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                rollbar.error("Unable to refresh user's account balance", err);
            })
            .finally(() => (refreshing = false));
    }

    function withdraw() {
        if (!valid) return;

        withdrawing = true;
        error = undefined;
        api.withdrawICP({
            kind: "pending_icp_withdrawal",
            transferKind: "icp_withdrawal",
            to: targetAccount,
            amountE8s: amountToWithdrawE8s,
        })
            .then((resp) => {
                if (resp.kind === "completed_icp_withdrawal") {
                    console.log(resp);
                    amountToWithdrawE8s = BigInt(0);
                    targetAccount = "";
                    reset();
                    toastStore.showSuccessToast("icpAccount.withdrawalSucceeded");
                } else {
                    error = "icpAccount.withdrawalFailed";
                    rollbar.error("Unable to withdraw ICP", resp);
                    toastStore.showFailureToast("icpAccount.withdrawalFailed");
                }
            })
            .catch((err) => {
                error = "icpAccount.withdrawalFailed";
                rollbar.error("Unable to withdraw ICP", err);
                toastStore.showFailureToast("icpAccount.withdrawalFailed");
            })
            .finally(() => (withdrawing = false));
    }
</script>

<Overlay dismissible={true} bind:active={open}>
    <ModalContent>
        <span class="header" slot="header">
            <div class="main-title">{$_("icpAccount.manageHeader")}</div>
            <div class="balance">
                <div class="amount">{formatICP(remainingBalanceE8s, 2)}</div>
                <div class="label">
                    {amountToWithdrawE8s > BigInt(0)
                        ? $_("icpAccount.shortRemainingBalanceLabel")
                        : $_("icpAccount.shortBalanceLabel")}
                </div>
            </div>
            <div class="refresh" class:refreshing on:click={reset}>
                <Refresh size={"1em"} color={"var(--accent)"} />
            </div>
        </span>
        <form class="body" slot="body">
            <h4 class="title">{$_("icpAccount.topUp")}</h4>
            <AccountInfo qrSize={"smaller"} {user} />

            <div class="or">
                <hr />
                <span>or</span>
                <hr />
            </div>

            <h4 class="title">{$_("icpAccount.withdraw")}</h4>

            <Legend>{$_("icpTransfer.amount")}</Legend>
            <div class="icp-input">
                <ICPInput
                    maxAmountE8s={$icpBalanceE8sStore.e8s - ICP_TRANSFER_FEE_E8S}
                    bind:amountE8s={amountToWithdrawE8s} />
            </div>
            <div class="target">
                <Input
                    bind:value={targetAccount}
                    countdown={false}
                    maxlength={100}
                    placeholder={$_("icpAccount.withdrawTarget")} />

                <div class="send" class:valid on:click={withdraw} class:withdrawing>
                    {#if !withdrawing}
                        <Send
                            size={$iconSize}
                            color={valid ? "var(--accent)" : "var(--icon-txt)"} />
                    {/if}
                </div>
            </div>
            <div class="fee">
                {$_("icpTransfer.fee", { values: { fee: formatICP(ICP_TRANSFER_FEE_E8S, 0) } })}
            </div>
            {#if error}
                <ErrorMessage>{$_(error)}</ErrorMessage>
            {/if}
        </form>
        <span class="footer" slot="footer">
            <a
                class="how-to"
                href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                target="_blank">
                {$_("howToBuyICP")}
            </a>
            <ButtonGroup>
                <Button tiny={true} secondary={true} on:click={() => (open = false)}
                    >{$_("close")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .or {
        display: flex;
        gap: $sp4;
        align-items: center;
        margin: 0 auto $sp4 auto;
        width: 80%;

        hr {
            flex: auto;
            border-top: 1px solid var(--modal-header-bd);
        }
    }

    .title {
        @include font(bold, normal, fs-120);
        margin-bottom: $sp4;
    }

    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .main-title {
            flex: auto;
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

            @include mobile() {
                height: 21.59px;
                width: 21.59px;
            }
        }
    }
    .how-to {
        @include font(light, normal, fs-90);
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
    }
    .footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
    }

    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .icp-input {
        width: 250px;
        margin-bottom: $sp3;
    }

    .target {
        width: 250px;
        margin-bottom: $sp3;
        position: relative;

        .send {
            position: absolute !important;
            top: 10px;
            right: -30px;

            &.valid {
                cursor: pointer;
            }

            &.withdrawing {
                @include loading-spinner(1em, 0.5em, false, var(--button-spinner));
                top: 21px;
                right: -16px;
            }
        }
    }
    .fee {
        @include font(light, normal, fs-60);
        margin-bottom: $sp3;
        text-transform: lowercase;
    }
</style>
