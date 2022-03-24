<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CryptocurrencyContent } from "../../domain/chat/chat";
    import Markdown from "./Markdown.svelte";
    import Envelope from "../Envelope.svelte";
    import ChevronDoubleRight from "svelte-material-icons/ChevronDoubleRight.svelte";
    import ChevronDoubleLeft from "svelte-material-icons/ChevronDoubleLeft.svelte";
    import { iconSize } from "stores/iconSize";
    import { formatICP } from "../../utils/cryptoFormatter";
    import { userStore } from "../../stores/user";
    import { getContext } from "svelte";
    import type { CreatedUser } from "../../domain/user/user";
    import { currentUserKey } from "../../fsm/home.controller";

    export let content: CryptocurrencyContent;
    export let me: boolean = false;
    export let reply: boolean = false;

    const user = getContext<CreatedUser>(currentUserKey);

    let amount: bigint =
        content.transfer.kind === "completed_icp_transfer" ||
        content.transfer.kind === "pending_icp_transfer"
            ? content.transfer.amountE8s
            : BigInt(0);

    function username(userId: string): string {
        return $userStore[userId]?.username ?? $_("unknown");
    }
</script>

{#if content.transfer.kind === "completed_icp_transfer"}
    <div class="message">
        <div class="env">
            <Envelope />
        </div>
        <div class="txt">
            {#if me}
                <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
                <span class="transfer-txt">
                    {$_("icpTransfer.confirmedSent", {
                        values: {
                            amount: formatICP(amount, 0),
                            receiver: username(content.transfer.recipient),
                        },
                    })}
                </span>
                <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
            {:else if content.transfer.recipient === user.userId}
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
                <span class="transfer-txt">
                    {$_("icpTransfer.confirmedReceived", {
                        values: { amount: formatICP(amount, 0) },
                    })}
                </span>
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
                <span class="transfer-txt">
                    {$_("icpTransfer.someoneConfirmedReceived", {
                        values: {
                            amount: formatICP(amount, 0),
                            receiver: username(content.transfer.recipient),
                        },
                    })}
                </span>
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </div>
    </div>
    <div class="link">
        <Markdown
            text={$_("icpTransfer.viewTransaction", {
                values: {
                    url: `https://dashboard.internetcomputer.org/transaction/${content.transfer.transactionHash}`,
                },
            })}
            inline={!reply} />
    </div>
{:else if content.transfer.kind === "pending_icp_transfer"}
    <div class="message">
        <div class="env">
            <Envelope />
        </div>
        <div class="txt">
            {#if me}
                <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
                <span class="transfer-txt">
                    {$_("icpTransfer.pendingSent", {
                        values: {
                            amount: formatICP(amount, 0),
                            receiver: username(content.transfer.recipient),
                        },
                    })}
                </span>
                <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
            {:else if content.transfer.recipient === user.userId}
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
                <span class="transfer-txt">
                    {$_("icpTransfer.pendingReceived", {
                        values: { amount: formatICP(amount, 0) },
                    })}
                </span>
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
                <span class="transfer-txt">
                    {$_("icpTransfer.someonePendingReceived", {
                        values: {
                            amount: formatICP(amount, 0),
                            receiver: username(content.transfer.recipient),
                        },
                    })}
                </span>
                <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </div>
    </div>
{:else}
    <div class="unexpected">{$_("icpTransfer.unexpected")}</div>
{/if}

{#if content.caption !== undefined}
    <Markdown text={content.caption} inline={!reply} />
{/if}

<style type="text/scss">
    .unexpected {
        @include font(light, italic, fs-90);
    }

    .link {
        margin-bottom: $sp3;
    }

    .message {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: 12px;
        margin-bottom: $sp3;

        .env {
            margin-top: 30px;
        }

        .txt {
            flex: auto;
        }
    }

    .transfer-txt {
        text-align: center;
    }

    .txt {
        display: flex;
        align-items: center;
    }
</style>
