<script lang="ts">
    import type { OpenChat, P2PSwapContent } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import ProgressSteps, { type Result, type Step } from "../ProgressSteps.svelte";
    import { getContext } from "svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");
    const labelPrefix = "p2pSwap.progress.";

    interface Props {
        senderId: string;
        content: P2PSwapContent;
        onClose: () => void;
    }

    let { senderId, content, onClose }: Props = $props();

    let steps: Step[] = $state([
        { label: "open", status: "done" },
        { label: "waiting", status: "todo" },
    ]);
    let result = $state<Result>(undefined);
    let token0TxnOut: string | undefined = $state(undefined);
    let token1TxnIn: string | undefined = $state(undefined);
    let token1TxnOut: string | undefined = $state(undefined);
    let user1: string | undefined = $state(undefined);

    function toUser(userId: string): string {
        return `@UserId(${userId})`;
    }
    $effect(() => {
        if (content.status.kind === "p2p_swap_cancelled") {
            if (content.status.token0TxnOut === undefined) {
                steps = [
                    { label: "open", status: "done" },
                    { label: "cancelled_pending", status: "doing" },
                ];
            } else {
                steps = [
                    { label: "open", status: "done" },
                    { label: "refunded", status: "done" },
                ];
                result = { label: "cancelled", status: "failed" };
                token0TxnOut = client.buildTransactionUrl(
                    content.status.token0TxnOut,
                    content.token0.ledger,
                );
            }
        } else if (content.status.kind === "p2p_swap_expired") {
            if (content.status.token0TxnOut === undefined) {
                steps = [
                    { label: "open", status: "done" },
                    { label: "expired_pending", status: "doing" },
                ];
            } else {
                steps = [
                    { label: "open", status: "done" },
                    { label: "refunded", status: "done" },
                ];
                result = { label: "expired", status: "failed" };
                token0TxnOut = client.buildTransactionUrl(
                    content.status.token0TxnOut,
                    content.token0.ledger,
                );
            }
        } else if (content.status.kind === "p2p_swap_reserved") {
            steps = [
                { label: "open", status: "done" },
                { label: "reserved", status: "doing" },
            ];
            user1 = toUser(content.status.reservedBy);
        } else if (content.status.kind === "p2p_swap_accepted") {
            steps = [
                { label: "open", status: "done" },
                { label: "accepting", status: "done" },
                { label: "accepted", status: "done" },
                { label: "swapping", status: "doing" },
            ];
            user1 = toUser(content.status.acceptedBy);
            token1TxnIn = client.buildTransactionUrl(
                content.status.token1TxnIn,
                content.token1.ledger,
            );
        } else if (content.status.kind === "p2p_swap_completed") {
            steps = [
                { label: "open", status: "done" },
                { label: "accepting", status: "done" },
                { label: "accepted", status: "done" },
                { label: "swapped", status: "done" },
            ];
            result = { label: "completed", status: "done" };
            user1 = toUser(content.status.acceptedBy);
            token1TxnIn = client.buildTransactionUrl(
                content.status.token1TxnIn,
                content.token1.ledger,
            );
            token0TxnOut = client.buildTransactionUrl(
                content.status.token0TxnOut,
                content.token0.ledger,
            );
            token1TxnOut = client.buildTransactionUrl(
                content.status.token0TxnOut,
                content.token0.ledger,
            );
        }
    });
    let fullSteps = $derived(
        steps.map((step) => ({ label: labelPrefix + step.label, status: step.status })),
    );
    let fullResult = $derived(
        result !== undefined
            ? { label: labelPrefix + result.label, status: result.status }
            : undefined,
    );
    let labelValues = $derived({
        token0: content.token0.symbol,
        token1: content.token1.symbol,
        amount0: client.formatTokens(content.token0Amount, content.token0.decimals),
        amount1: client.formatTokens(content.token1Amount, content.token1.decimals),
        user0: toUser(senderId),
        user1,
        token0TxnIn: client.buildTransactionUrl(content.token0TxnIn, content.token0.ledger),
        token0TxnOut,
        token1TxnIn,
        token1TxnOut,
    });
    let title = $derived(i18nKey("p2pSwap.swapTokenTo", labelValues));
</script>

<Overlay dismissible {onClose}>
    <ModalContent hideFooter>
        {#snippet header()}
            <Translatable resourceKey={title} />
        {/snippet}
        {#snippet body()}
            <div class="p2p-swap-progress">
                <ProgressSteps steps={fullSteps} {labelValues} result={fullResult} />
            </div>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    :global(.p2p-swap-progress .markdown-wrapper a) {
        color: unset;
        text-decoration: none;
        &:hover {
            text-decoration: underline;
        }
    }
</style>
