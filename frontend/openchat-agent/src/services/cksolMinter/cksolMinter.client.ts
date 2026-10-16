import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import {
    LEDGER_CANISTER_CKSOL,
    type CksolMinterDepositInfo,
    type CksolMinterWithdrawalInfo,
    type WithdrawSolResponse,
} from "@shared";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { idlFactory, type CksolMinterService } from "./candid/idl";
import { withdrawSolResponse } from "./mappers";

// The mainnet minter in every environment, since the user's canister generates deposit addresses
// with it, and the ckSOL it mints is the ckSOL the Registry lists
const CKSOL_MINTER_CANISTER_ID = "lh22c-kyaaa-aaaar-qb5nq-cai";

export class CksolMinterClient extends CandidCanisterAgent<CksolMinterService> {
    #cachedMinterInfo: CksolMinterInfo | undefined;
    // The minter, and the ledger of the ckSOL it mints and burns
    readonly canisterId = CKSOL_MINTER_CANISTER_ID;
    readonly ledger = LEDGER_CANISTER_CKSOL;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, CKSOL_MINTER_CANISTER_ID, idlFactory, "CksolMinter");
    }

    async getDepositInfo(): Promise<CksolMinterDepositInfo> {
        const { minimumDepositAmount } = await this.getMinterInfoCached();
        return { minimumDepositAmount };
    }

    async getWithdrawalInfo(): Promise<CksolMinterWithdrawalInfo> {
        const { minWithdrawalAmount, withdrawalFee } = await this.getMinterInfoCached();
        return { minWithdrawalAmount, withdrawalFee };
    }

    // Has the minter burn `amount` of ckSOL from the caller's wallet, which they have approved it to
    // take, and send that much SOL, less its withdrawal fee, to `address`
    withdrawSol(address: string, amount: bigint): Promise<WithdrawSolResponse> {
        const args = { address, amount, from_subaccount: [] as [] };
        return this.handleResponse(this.service.withdraw_sol(args), withdrawSolResponse, args);
    }

    private async getMinterInfoCached(): Promise<CksolMinterInfo> {
        return (this.#cachedMinterInfo ??= await this.handleQueryResponse(
            () => this.service.get_minter_info(),
            (resp) => ({
                minimumDepositAmount: resp.minimum_deposit_amount,
                minWithdrawalAmount: resp.minimum_withdrawal_amount,
                withdrawalFee: resp.withdrawal_fee,
            }),
        ));
    }
}

type CksolMinterInfo = {
    minimumDepositAmount: bigint;
    minWithdrawalAmount: bigint;
    withdrawalFee: bigint;
};
