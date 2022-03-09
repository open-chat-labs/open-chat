<script lang="ts">
    import Button from "../Button.svelte";
    import { fade } from "svelte/transition";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, ICP_TRANSFER_FEE } from "../../domain/user/user";
    import Input from "../Input.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { avatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import Legend from "../Legend.svelte";
    import Loading from "../Loading.svelte";
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
    const dispatch = createEventDispatcher();

    export let open: boolean;
    export let receiverId: string;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let refreshing = false;
    let error: string | undefined = undefined;
    let accountBalance: number = 0;
    let draftAmount = 0;
    let message = "";

    $: icpBalance = accountBalance / E8S_PER_ICP; //balance in the user's account expressed as ICP
    $: remainingBalance = Math.max(0, icpBalance - draftAmount - ICP_TRANSFER_FEE);
    $: valid = error === undefined && draftAmount > 0;
    $: receiver = $userStore[receiverId];

    $: {
        if (draftAmount > icpBalance - ICP_TRANSFER_FEE) {
            draftAmount = icpBalance - ICP_TRANSFER_FEE;
        }
        if (draftAmount < 0) {
            draftAmount = 0;
        }
    }

    export function reset(amount: number) {
        refreshing = true;
        error = undefined;
        message = "";
        api.refreshAccountBalance(user.icpAccount)
            .then((resp) => {
                accountBalance = Number(resp.e8s);
                error = undefined;
            })
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                // accountBalance = 1234567864;
                accountBalance = 0;
                draftAmount = amount;
                rollbar.error("Unable to refresh user's account balance", err);
            })
            .finally(() => (refreshing = false));
    }

    function send() {
        const content = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                transferKind: "icp_transfer",
                kind: "pending_icp_transfer",
                recipient: receiverId,
                amountE8s: BigInt(draftAmount),
            },
        };
        dispatch("sendTransfer", content);
        open = false;
    }
</script>

<Overlay dismissible={true} bind:active={open}>
    <ModalContent>
        <span class="header" slot="header">
            <span class="avatar">
                <Avatar
                    url={avatarUrl(receiver)}
                    status={getUserStatus($now, $userStore, receiverId)}
                    size={AvatarSize.Tiny} />
            </span>
            {$_("icpTransfer.title", { values: { username: receiver?.username ?? "unknown" } })}
        </span>
        <form slot="body">
            {#if refreshing}
                <Loading />
            {:else}
                <div class="transfer">
                    <div class="left">
                        <Legend>{$_("icpTransfer.amount")}</Legend>
                        <input
                            autofocus={true}
                            class="amount"
                            min={0}
                            max={icpBalance}
                            type="number"
                            bind:value={draftAmount} />
                    </div>
                    <div class="right">
                        <Legend>{$_("icpTransfer.balance")}</Legend>
                        <div class="balance">{remainingBalance.toFixed(4)}</div>
                    </div>
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
            {/if}
            {#if error}
                <h4 in:fade class="error">{$_(error)}</h4>
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
                <Button disabled={!valid} small={true} on:click={send}
                    >{$_("icpTransfer.send")}</Button>
                <Button small={true} secondary={true} on:click={() => (open = false)}
                    >{$_("cancel")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: $sp4;
    }
    .transfer {
        display: flex;
        gap: $sp4;
        justify-content: space-between;
        align-items: center;
        margin-bottom: $sp4;
    }
    .error {
        @include font(bold, normal, fs-100);
        color: var(--error);
        text-align: center;
    }
    .how-to {
        @include font(light, normal, fs-90);
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
    }

    .balance {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 0 $sp2;
    }

    .balance,
    .amount {
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
    }
    .amount {
        display: block;
        outline: none;
    }

    .left,
    .right {
        flex: 1;
    }

    .footer {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .fee {
        @include font(light, normal, fs-60);
        margin-bottom: $sp3;
        text-transform: lowercase;
    }
</style>
