<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, ICP_TRANSFER_FEE } from "../../domain/user/user";
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
    import { E8S_PER_ICP } from "../../domain/user/user";
    import type { CreatedUser } from "../../domain/user/user";
    import { now } from "../../stores/time";
    import { userStore } from "../../stores/user";
    import { currentUserKey } from "../../fsm/home.controller";
    import { rollbar } from "../../utils/logging";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import { iconSize } from "../../stores/iconSize";
    import { icpBalanceStore } from "../../stores/balance";
    const dispatch = createEventDispatcher();

    export let open: boolean;
    export let receiverId: string;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let refreshing = false;
    let error: string | undefined = undefined;
    let draftAmount = 0;
    let message = "";
    let confirming = false;

    $: remainingBalance =
        draftAmount > 0
            ? Math.max(0, $icpBalanceStore - draftAmount - ICP_TRANSFER_FEE)
            : $icpBalanceStore;
    $: valid = error === undefined && draftAmount > 0;
    $: receiver = $userStore[receiverId];
    $: mobile = $screenWidth === ScreenWidth.ExtraSmall;

    $: {
        if (draftAmount > $icpBalanceStore - ICP_TRANSFER_FEE) {
            draftAmount = $icpBalanceStore - ICP_TRANSFER_FEE;
        }
        if (draftAmount < 0) {
            draftAmount = 0;
        }
    }

    export function reset(amount: number) {
        refreshing = true;
        error = undefined;
        draftAmount = 0;
        confirming = false;
        message = "";
        api.refreshAccountBalance(user.icpAccount)
            .then((_) => {
                draftAmount = amount;
                error = undefined;
            })
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                rollbar.error("Unable to refresh user's account balance", err);
            })
            .finally(() => (refreshing = false));
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
                amountE8s: BigInt(draftAmount * E8S_PER_ICP),
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
                <div class="amount">{remainingBalance.toFixed(4)}</div>
                <div class="label">
                    {draftAmount > 0
                        ? $_("icpAccount.shortRemainingBalanceLabel")
                        : $_("icpAccount.shortBalanceLabel")}
                </div>
            </div>
            <div class="refresh" class:refreshing class:mobile on:click={() => reset(draftAmount)}>
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
                            bind:value={draftAmount} />
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
        <span class="footer" slot="footer">
            <a
                class="how-to"
                href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                target="_blank">
                {$_("howToBuyICP")}
            </a>
            <ButtonGroup>
                <Button disabled={!valid} small={true} on:click={send}
                    >{confirming ? $_("icpTransfer.confirm") : $_("icpTransfer.send")}</Button>
                <Button small={true} secondary={true} on:click={() => (open = false)}
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
    }
    .fee {
        @include font(light, normal, fs-60);
        margin-bottom: $sp3;
        text-transform: lowercase;
    }
</style>
