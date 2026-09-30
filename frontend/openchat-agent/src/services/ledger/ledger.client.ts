import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type LedgerService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { APPROVAL_VALIDITY_MS, type IcrcAccount } from "@shared";
import { apiIcrcAccount } from "../../utils/icrcAccount";
import { approvalToAdd, type Allowance } from "./approval";

export type ApproveSpendingResponse = "success" | "insufficient_funds" | "failure";

export class LedgerClient extends CandidCanisterAgent<LedgerService> {
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, undefined, idlFactory, "Ledger");
    }

    accountBalance(ledger: string, account: IcrcAccount): Promise<bigint> {
        return this.handleQueryResponse(
            () =>
                this.service.icrc1_balance_of.withOptions({ canisterId: ledger })(
                    apiIcrcAccount(account),
                ),
            (balance) => {
                return balance;
            },
        );
    }

    // What `spender` may still pull from `account`. An approval which has expired is reported by
    // the ledger as an allowance of zero.
    allowance(ledger: string, account: IcrcAccount, spender: IcrcAccount): Promise<Allowance> {
        return this.handleQueryResponse(
            () =>
                this.service.icrc2_allowance.withOptions({ canisterId: ledger })({
                    account: apiIcrcAccount(account),
                    spender: apiIcrcAccount(spender),
                }),
            ({ allowance, expires_at }) => ({ allowance, expiresAt: expires_at[0] }),
        );
    }

    // Lets `spender` pull a further `amount` from the caller's own account, the one held by the
    // principal they sign in with, on top of whatever it may pull already (see `approvalToAdd`).
    // `amount` must include the fee the ledger charges for each transfer the spender makes. `fee`
    // is what the ledger charges for the approval itself, which isn't made, so isn't charged for,
    // unless the account can then afford the payment. `validityMs` is how long the spender has to
    // pull the payment, by default long enough for one pulled at once.
    async approveSpending(
        ledger: string,
        spender: IcrcAccount,
        amount: bigint,
        fee: bigint,
        validityMs: number = APPROVAL_VALIDITY_MS,
    ): Promise<ApproveSpendingResponse> {
        const account = { owner: this.principal };
        let now = BigInt(Date.now()) * 1_000_000n;

        // A second attempt is only made if the allowance changed between reading it and adding to
        // it, which takes another payment being approved at that very moment, or if this device's
        // clock is so slow that the ledger found the approval to have expired already, in which
        // case the ledger's own time is used instead
        for (let attempt = 0; attempt < 2; attempt++) {
            const [current, balance] = await Promise.all([
                this.allowance(ledger, account, spender),
                this.accountBalance(ledger, account),
            ]);
            if (balance < amount + fee) {
                return "insufficient_funds";
            }

            const approval = approvalToAdd(current, amount, now, validityMs);
            const response = await this.handleResponse(
                this.service.icrc2_approve.withOptions({ canisterId: ledger })({
                    spender: apiIcrcAccount(spender),
                    amount: approval.amount,
                    expected_allowance: [approval.expectedAllowance],
                    expires_at: approval.expiresAt === undefined ? [] : [approval.expiresAt],
                    from_subaccount: [],
                    fee: [],
                    memo: [],
                    created_at_time: [],
                }),
                (resp) => resp,
            );

            if ("Ok" in response) {
                return "success";
            }
            if ("InsufficientFunds" in response.Err) {
                return "insufficient_funds";
            }
            if ("Expired" in response.Err) {
                now = response.Err.Expired.ledger_time;
            } else if (!("AllowanceChanged" in response.Err)) {
                console.warn("Failed to approve spending", ledger, response.Err);
                return "failure";
            }
        }
        console.warn("Gave up approving spending after a second attempt", ledger);
        return "failure";
    }
}
