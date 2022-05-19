<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Avatar from "../Avatar.svelte";
    import {
        AvatarSize,
        E8S_PER_ICP,
        ICP_TRANSFER_FEE_E8S,
        UserStatus,
    } from "../../domain/user/user";
    import type { PartialUserSummary } from "../../domain/user/user";
    import ICPInput from "./ICPInput.svelte";
    import Input from "../Input.svelte";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
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
    import { formatICP } from "../../utils/cryptoFormatter";
    import { rollbar } from "../../utils/logging";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { iconSize } from "../../stores/iconSize";
    import { icpBalanceE8sStore } from "../../stores/balance";
    import type { ChatController } from "../../fsm/chat.controller";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import Link from "../Link.svelte";

    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let open: boolean;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let refreshing = false;
    let error: string | undefined = undefined;
    let draftAmountE8s: bigint = BigInt(0);
    let message = "";
    let confirming = false;
    let receiver: PartialUserSummary | undefined = undefined;
    let toppingUp = false;

    $: chat = controller.chat;
    $: group = $chat.kind === "group_chat";
    $: blockedUsers = controller.blockedUsers;
    $: participants = controller.participants;
    $: remainingBalanceE8s =
        draftAmountE8s > BigInt(0)
            ? $icpBalanceE8sStore.e8s - draftAmountE8s - ICP_TRANSFER_FEE_E8S
            : $icpBalanceE8sStore.e8s;
    $: valid = error === undefined && draftAmountE8s > BigInt(0) && receiver !== undefined;
    $: zero = $icpBalanceE8sStore.e8s <= ICP_TRANSFER_FEE_E8S;

    export function reset(amountE8s: bigint) {
        refreshing = true;
        error = undefined;
        draftAmountE8s = BigInt(0);
        confirming = false;
        message = "";

        receiver =
            controller.chatVal.kind === "direct_chat"
                ? $userStore[controller.chatVal.them]
                : undefined;
        return api
            .refreshAccountBalance(user.icpAccount)
            .then((_) => {
                draftAmountE8s = amountE8s;
                error = undefined;
            })
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                rollbar.error("Unable to refresh user's account balance", err);
            })
            .finally(() => (refreshing = false));
    }

    function refreshAndContinue() {
        reset(draftAmountE8s).then(() => (toppingUp = false));
    }

    function maxAmountE8s(): bigint {
        const maxAvailable = $icpBalanceE8sStore.e8s - ICP_TRANSFER_FEE_E8S;
        const maxAllowed = BigInt(10 * E8S_PER_ICP);
        return maxAvailable > maxAllowed ? maxAllowed : maxAvailable;
    }

    function send() {
        if (!confirming) {
            confirming = true;
            return;
        }

        if (receiver === undefined) return;

        const content = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                token: "icp",
                kind: "pending",
                recipient: receiver.userId,
                amountE8s: draftAmountE8s,
            },
        };
        dispatch("sendTransfer", [content, undefined]);
        open = false;
    }
</script>

{#if open}
    <Overlay dismissible={true}>
        <ModalContent fill={confirming}>
            <span class="header" slot="header">
                <div class="left">
                    <span class="avatar">
                        <Avatar
                            url={avatarUrl(receiver)}
                            status={receiver
                                ? getUserStatus($now, $userStore, receiver.userId)
                                : UserStatus.None}
                            size={AvatarSize.Small} />
                    </span>
                    <div class="main-title">
                        {$_("icpTransfer.title")}
                    </div>
                </div>
                <div class="balance">
                    <div class="amount">{formatICP(remainingBalanceE8s, 4)}</div>
                    <div class="label">
                        {draftAmountE8s > BigInt(0)
                            ? $_("icpAccount.shortRemainingBalanceLabel")
                            : $_("icpAccount.shortBalanceLabel")}
                    </div>
                </div>
                <div class="refresh" class:refreshing on:click={() => reset(draftAmountE8s)}>
                    <Refresh size={"1em"} color={"var(--accent)"} />
                </div>
            </span>
            <form slot="body">
                <div class="body" class:confirming class:zero={zero || toppingUp}>
                    {#if zero || toppingUp}
                        <AccountInfo qrSize={"smaller"} {user} />
                        {#if zero}
                            <p>{$_("icpTransfer.zeroBalance")}</p>
                        {/if}
                        <p>{$_("icpTransfer.makeDeposit")}</p>
                        <p class="back">
                            <ArrowLeft size={"0.8em"} color={"var(--txt)"} />
                            <Link underline="always" on:click={refreshAndContinue}>
                                {$_("icpTransfer.done")}
                            </Link>
                        </p>
                    {:else if confirming}
                        <div class="alert">
                            <AlertOutline size={$iconSize} color={"var(--toast-failure-txt"} />
                        </div>
                        <div class="alert-txt">
                            {$_("icpTransfer.warning")}
                        </div>
                    {:else}
                        {#if group}
                            <div class="receiver">
                                <Legend>{$_("icpTransfer.receiver")}</Legend>
                                <SingleUserSelector
                                    bind:selectedReceiver={receiver}
                                    participants={$participants}
                                    blockedUsers={$blockedUsers}
                                    autofocus={group} />
                            </div>
                        {/if}
                        <div class="transfer">
                            <Legend>{$_("icpTransfer.amount")}</Legend>
                            <ICPInput
                                autofocus={!group}
                                maxAmountE8s={maxAmountE8s()}
                                bind:amountE8s={draftAmountE8s} />
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
                            <span>
                                {$_("icpTransfer.fee", {
                                    values: { fee: formatICP(ICP_TRANSFER_FEE_E8S, 0) },
                                })}
                            </span>
                        </div>
                        {#if error}
                            <ErrorMessage>{$_(error)}</ErrorMessage>
                        {/if}
                    {/if}
                </div>
            </form>
            <span class="footer" class:zero={zero || toppingUp} slot="footer">
                {#if !zero && !toppingUp}
                    <span class="topup">
                        <Link underline={"always"} on:click={() => (toppingUp = true)}>
                            {$_("icpAccount.topUp")}
                        </Link>
                    </span>
                {:else if !$mobileWidth}
                    <a
                        class="how-to"
                        href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                        target="_blank">
                        {$_("howToBuyICP")}
                    </a>
                {/if}
                <ButtonGroup>
                    {#if zero}
                        <Button
                            disabled={refreshing}
                            loading={refreshing}
                            tiny={true}
                            on:click={() => reset(draftAmountE8s)}>{$_("refresh")}</Button>
                    {:else}
                        <Button disabled={!valid} tiny={true} on:click={send}
                            >{confirming
                                ? $_("icpTransfer.confirm")
                                : $_("icpTransfer.send")}</Button>
                    {/if}
                    <Button tiny={true} secondary={true} on:click={() => (open = false)}
                        >{$_("cancel")}</Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

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

            @include mobile() {
                height: 21.59px;
                width: 21.59px;
            }
        }
    }

    .topup {
        @include font(book, normal, fs-90);
        text-transform: lowercase;
    }

    .body {
        padding: 0 $sp3;
        transition: background-color 100ms ease-in-out;

        &.zero {
            text-align: center;
            p {
                margin-bottom: $sp4;
            }
        }

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

    .back {
        @include font(light, normal, fs-90);
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

    .footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;

        @include mobile() {
            &.zero {
                justify-content: center;
            }
        }
    }
    .fee {
        @include font(light, normal, fs-60);
        margin-bottom: $sp3;
        text-transform: lowercase;
    }
</style>
