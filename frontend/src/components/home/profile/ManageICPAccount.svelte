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
    import { apiKey } from "../../../services/serviceContainer";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import { E8S_PER_ICP, ICP_TRANSFER_FEE } from "../../../domain/user/user";
    import type { CreatedUser } from "../../../domain/user/user";
    import { currentUserKey } from "../../../fsm/home.controller";
    import { rollbar } from "../../../utils/logging";
    import AccountInfo from "../AccountInfo.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { ScreenWidth, screenWidth } from "../../../stores/screenDimensions";
    import { toastStore } from "stores/toast";

    export let open: boolean;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let refreshing = false;
    let error: string | undefined = undefined;
    let accountBalance: number = 0;
    let targetAccount: string = "";
    let amountToWithdraw = 0;
    let withdrawing = false;

    // make sure that they are not trying to withdraw to the same account - I can see people trying to do that
    $: valid = amountToWithdraw > 0 && targetAccount !== "" && targetAccount !== user.icpAccount;

    $: icpBalance = accountBalance / E8S_PER_ICP; //balance in the user's account expressed as ICP
    $: remainingBalance = Math.max(0, icpBalance - amountToWithdraw - ICP_TRANSFER_FEE);

    $: {
        if (amountToWithdraw > icpBalance - ICP_TRANSFER_FEE) {
            amountToWithdraw = icpBalance - ICP_TRANSFER_FEE;
        }
        if (amountToWithdraw < 0) {
            amountToWithdraw = 0;
        }
    }

    $: mobile = $screenWidth === ScreenWidth.ExtraSmall;

    export function reset() {
        refreshing = true;
        error = undefined;
        api.refreshAccountBalance(user.icpAccount)
            .then((resp) => {
                accountBalance = Number(resp.e8s);
            })
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                accountBalance = 0;
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
            amountE8s: BigInt(amountToWithdraw * E8S_PER_ICP),
        })
            .then((resp) => {
                if (resp.kind === "completed_icp_withdrawal") {
                    console.log(resp);
                    amountToWithdraw = 0;
                    targetAccount = "";
                    reset();
                    toastStore.showSuccessToast("icpAccount.withdrawalSucceeded");
                } else {
                    error = "withdrawalFailed";
                    rollbar.error("Unable to withdraw ICP", resp);
                    toastStore.showFailureToast("icpAccount.withdrawalFailed");
                }
            })
            .catch((err) => {
                error = "withdrawalFailed";
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
                <div class="amount">{remainingBalance.toFixed(4)}</div>
                <div class="label">{$_("icpAccount.shortBalanceLabel")}</div>
            </div>
            <div class="refresh" class:refreshing class:mobile on:click={reset}>
                <Refresh size={"1em"} color={"var(--accent)"} />
            </div>
        </span>
        <form class="body" slot="body">
            <h4 class="title">{$_("icpAccount.topUp")}</h4>
            <AccountInfo qrSize={"smaller"} {api} {user} />

            <div class="or">
                <hr />
                <span>or</span>
                <hr />
            </div>

            <h4 class="title">{$_("icpAccount.withdraw")}</h4>

            <Legend>{$_("icpTransfer.amount")}</Legend>
            <input
                class="amount-val"
                min={0}
                max={icpBalance}
                type="number"
                bind:value={amountToWithdraw} />

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
                {$_("icpTransfer.fee", { values: { fee: ICP_TRANSFER_FEE.toString() } })}
            </div>
            <!-- {#if error}
                <ErrorMessage>{$_(error)}</ErrorMessage>
            {/if} -->
        </form>
        <span class="footer" slot="footer">
            <a
                class="how-to"
                href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                target="_blank">
                {$_("howToBuyICP")}
            </a>
            <ButtonGroup>
                <Button small={true} secondary={true} on:click={() => (open = false)}
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

            &.mobile {
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

    .amount-val {
        height: 40px;
        @include font(book, normal, fs-140);
        color: var(--input-txt);
        background-color: var(--input-bg);
        border: 1px solid var(--input-bd);
        line-height: 24px;
        width: 250px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-radius: $sp2;
        text-align: right;
        display: block;
        outline: none;
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
