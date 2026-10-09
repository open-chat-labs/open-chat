import type { HttpAgent } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";

// How long a payment waits for the time on the IC. The agent shares one reading between every
// caller until it completes, so a reading stuck on a dead connection would otherwise hold up every
// payment after it.
export const READ_IC_TIME_TIMEOUT_MS = 5_000;

// The time on the IC, read from the ledger's subnet, for stamping a transfer with just before it is
// made. A ledger rejects a transfer created more than a minute after its own time, which one
// stamped by a device whose clock is fast is. If the time can't be read, the agent's last reading
// is used, or failing that the device's clock.
export async function icNowNanos(agent: HttpAgent, ledger: string): Promise<bigint> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
        agent
            .syncTime(Principal.fromText(ledger))
            .catch((err) => console.warn("Failed to read the time on the IC", ledger, err)),
        new Promise<void>((resolve) => {
            timer = setTimeout(() => {
                console.warn("Timed out reading the time on the IC", ledger);
                resolve();
            }, READ_IC_TIME_TIMEOUT_MS);
        }),
    ]);
    clearTimeout(timer);

    return BigInt(Date.now() + agent.getTimeDiffMsecs()) * 1_000_000n;
}
