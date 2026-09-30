import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type LedgerService } from "./candid/idl";
import type { IcpTransferResult, TransferResult } from "./candid/types";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import {
    decodeIcrcAccount,
    ErrorCode,
    ICP_SYMBOL,
    isAccountIdentifierValid,
    type IcrcAccount,
    type PendingCryptocurrencyWithdrawal,
    type WithdrawCryptocurrencyResponse,
} from "@shared";
import { apiIcrcAccount } from "../../utils/icrcAccount";
import { bytesToBigint, hexStringToBytes } from "../../utils/mapping";
import { approvalToAdd, type Allowance } from "./approval";

export type ApproveSpendingResponse = "success" | "insufficient_funds" | "failure";

// The memo the User canister gives each withdrawal it makes, "OC_SEND" (`MEMO_SEND` in the backend's
// constants), which the ICP ledger's `transfer` takes as a number, as its big-endian bytes
const MEMO_SEND = new TextEncoder().encode("OC_SEND");
const MEMO_SEND_NUMBER = bytesToBigint(MEMO_SEND);

// What the ICP ledger charges for a transfer, which is what the User canister pays for one to an
// account identifier, so is paid here if the withdrawal doesn't say
const ICP_TRANSFER_FEE = 10_000n;

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
    // unless the account can then afford the payment.
    async approveSpending(
        ledger: string,
        spender: IcrcAccount,
        amount: bigint,
        fee: bigint,
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

            const approval = approvalToAdd(current, amount, now);
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

    // Sends a withdrawal from the caller's own account, the one held by the principal they sign in
    // with, as the User canister's `withdraw_crypto_v2` sends one from its own: ICP to an account
    // identifier through the ICP ledger's `transfer`, and anything else to an ICRC-1 account, paying
    // the fee given and with the same memo.
    async withdraw(
        domain: PendingCryptocurrencyWithdrawal,
    ): Promise<WithdrawCryptocurrencyResponse> {
        if (domain.token === ICP_SYMBOL && isAccountIdentifierValid(domain.to)) {
            const fee = domain.feeE8s ?? ICP_TRANSFER_FEE;
            const response = await this.handleResponse(
                this.service.transfer.withOptions({ canisterId: domain.ledger })({
                    to: hexStringToBytes(domain.to),
                    amount: { e8s: domain.amountE8s },
                    fee: { e8s: fee },
                    memo: MEMO_SEND_NUMBER,
                    from_subaccount: [],
                    created_at_time: [{ timestamp_nanos: domain.createdAtNanos }],
                }),
                (resp) => resp,
            );
            return withdrawalResponse(domain, fee, response);
        }

        const fee = domain.feeE8s ?? 0n;
        const response = await this.handleResponse(
            this.service.icrc1_transfer.withOptions({ canisterId: domain.ledger })({
                to: apiIcrcAccount(decodeIcrcAccount(domain.to)),
                amount: domain.amountE8s,
                fee: [fee],
                memo: [MEMO_SEND],
                from_subaccount: [],
                created_at_time: [domain.createdAtNanos],
            }),
            (resp) => resp,
        );
        return withdrawalResponse(domain, fee, response);
    }
}

// Maps what the ledger made of a withdrawal to what the User canister's `withdraw_crypto_v2` would
// have answered
function withdrawalResponse(
    domain: PendingCryptocurrencyWithdrawal,
    fee: bigint,
    result: TransferResult | IcpTransferResult,
): WithdrawCryptocurrencyResponse {
    const completed = (blockIndex: bigint): WithdrawCryptocurrencyResponse => ({
        kind: "completed",
        ledger: domain.ledger,
        to: domain.to,
        amountE8s: domain.amountE8s,
        feeE8s: fee,
        memo: MEMO_SEND_NUMBER,
        blockIndex,
    });

    if ("Ok" in result) {
        return completed(result.Ok);
    }

    const error = result.Err;
    // The same transfer, down to its creation time, was made already, so this one has been
    if ("Duplicate" in error) {
        return completed(error.Duplicate.duplicate_of);
    }
    if ("TxDuplicate" in error) {
        return completed(error.TxDuplicate.duplicate_of);
    }
    if ("InsufficientFunds" in error) {
        return { kind: "error", code: ErrorCode.InsufficientFunds, message: undefined };
    }

    const details = JSON.stringify(error, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    const message = `Transfer failed. ${details}`;
    console.warn(message, domain.ledger);
    return { kind: "error", code: ErrorCode.TransferFailed, message };
}
