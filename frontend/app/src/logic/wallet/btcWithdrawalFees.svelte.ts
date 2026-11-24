import type { CkbtcMinterWithdrawalInfo } from "@client";
import { CkbtcWithdrawalInfoRequests } from "@src/utils/ckbtcWithdrawalInfo";
import type { BtcWithdrawal } from "./walletSend";

/**
 * The ckBTC minter's fee and minimum for a Bitcoin send, while a Send that could make one is open
 * (both wallets' Send): asked as it starts, again `retryMs` after a failure, and only the latest
 * answer counts (#9638). Stopping drops what's still on its way and what it knew, so the next
 * opening asks again. Moved here from the web's wallet screen (native N10b).
 */
export class BtcWithdrawalFees {
    #current = $state<BtcWithdrawal>();
    #requests: CkbtcWithdrawalInfoRequests;
    #retry: ReturnType<typeof setTimeout> | undefined;
    #active = false;

    constructor(
        fetch: (amount: bigint) => Promise<CkbtcMinterWithdrawalInfo>,
        private retryMs = 10_000,
    ) {
        this.#requests = new CkbtcWithdrawalInfoRequests(
            fetch,
            (info) =>
                (this.#current = { fee: info.feeEstimate, minimum: info.minWithdrawalAmount }),
            500,
            () => {
                if (this.#active)
                    this.#retry = setTimeout(() => this.#requests.now(0n), this.retryMs);
            },
        );
    }

    /** The minter's latest answer since it started; none before. */
    get current(): BtcWithdrawal | undefined {
        return this.#current;
    }

    /** Asks the minter now (its estimate for any amount). */
    start(): void {
        this.#active = true;
        this.#requests.now(0n);
    }

    /** Stops asking and forgets the answer. */
    stop(): void {
        this.#active = false;
        clearTimeout(this.#retry);
        this.#requests.cancel();
        this.#current = undefined;
    }
}
