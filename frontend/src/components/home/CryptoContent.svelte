<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CryptocurrencyContent } from "../../domain/chat/chat";
    import Markdown from "./Markdown.svelte";
    import Envelope from "../Envelope.svelte";
    import { formatICP } from "../../utils/cryptoFormatter";
    import { userStore } from "../../stores/user";
    import { getContext } from "svelte";
    import type { CreatedUser } from "../../domain/user/user";
    import { currentUserKey } from "../../fsm/home.controller";

    export let content: CryptocurrencyContent;
    export let me: boolean = false;
    export let first: boolean;
    export let reply: boolean = false;
    export let senderId: string;
    export let groupChat: boolean;

    const user = getContext<CreatedUser>(currentUserKey);

    let senderName = username(senderId);

    let amount: bigint =
        content.transfer.kind === "completed_icp_transfer" ||
        content.transfer.kind === "pending_icp_transfer"
            ? content.transfer.amountE8s
            : BigInt(0);

    function username(userId: string): string {
        return userId === user.userId
            ? $_("you")
            : `${$userStore[userId]?.username ?? $_("unknown")}`;
    }
</script>

{#if content.transfer.kind === "completed_icp_transfer"}
    <div class="message">
        <div class="env" class:me class:first class:groupChat>
            <Envelope />
        </div>
        <div class="txt">
            <span class="transfer-txt">
                {$_("icpTransfer.confirmedSent", {
                    values: {
                        amount: formatICP(amount, 0),
                        receiver: username(content.transfer.recipient),
                        sender: senderName,
                    },
                })}
            </span>
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
        <div class="env" class:me class:first class:groupChat>
            <Envelope />
        </div>
        <div class="txt">
            {#if me}
                <span class="transfer-txt">
                    {$_("icpTransfer.pendingSentByYou", {
                        values: {
                            amount: formatICP(amount, 0),
                            receiver: username(content.transfer.recipient),
                        },
                    })}
                </span>
            {:else}
                <span class="transfer-txt">
                    {$_("icpTransfer.pendingSent", {
                        values: {
                            amount: formatICP(amount, 0),
                            receiver: username(content.transfer.recipient),
                            sender: senderName,
                        },
                    })}
                </span>
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
        text-align: center;
        margin-bottom: $sp3;
        @include font-size(fs-90);
    }

    .message {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: 12px;
        margin-bottom: $sp3;
        padding: 0 $sp3;

        .env {
            margin-top: 30px;
            &.first:not(.me).groupChat {
                margin-top: 10px;
            }
        }

        .txt {
            flex: auto;
        }
    }

    .transfer-txt {
        @include font-size(fs-120);
        text-align: center;
        text-shadow: 0px -1px 0px rgba(0, 0, 0, 0.5);
    }

    .txt {
        display: flex;
        align-items: center;
    }
</style>
