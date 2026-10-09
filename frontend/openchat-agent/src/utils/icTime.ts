import type { HttpAgent } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";

// A ledger rejects a transfer created more than a minute after its own time, which one stamped by
// a device whose clock is fast is. So a transfer is stamped no later than the time on the IC, read
// from the ledger's subnet just before the transfer is made. A stamp which is no later than that
// is kept, so that a message retried with the stamp it was first sent with is deduplicated by the
// ledger rather than paid twice. If the time can't be read, the agent's last reading is used, or
// failing that the device's clock, which keeps the stamp.
export async function transferCreatedAt(
    agent: HttpAgent,
    transfer: { ledger: string; createdAtNanos: bigint },
): Promise<bigint> {
    await agent
        .syncTime(Principal.fromText(transfer.ledger))
        .catch((err) => console.warn("Failed to read the time on the IC", transfer.ledger, err));

    const icNowNanos = BigInt(Date.now() + agent.getTimeDiffMsecs()) * 1_000_000n;
    return transfer.createdAtNanos < icNowNanos ? transfer.createdAtNanos : icNowNanos;
}
