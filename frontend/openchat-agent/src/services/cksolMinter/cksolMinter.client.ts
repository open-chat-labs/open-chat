import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { CksolMinterDepositInfo } from "@shared";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { idlFactory, type CksolMinterService } from "./candid/idl";

// The mainnet minter in every environment, since the user's canister generates deposit addresses
// with it, and the ckSOL it mints is the ckSOL the Registry lists
const CKSOL_MINTER_CANISTER_ID = "lh22c-kyaaa-aaaar-qb5nq-cai";

export class CksolMinterClient extends CandidCanisterAgent<CksolMinterService> {
    #cachedDepositInfo: CksolMinterDepositInfo | undefined;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, CKSOL_MINTER_CANISTER_ID, idlFactory, "CksolMinter");
    }

    async getDepositInfo(): Promise<CksolMinterDepositInfo> {
        return (this.#cachedDepositInfo ??= await this.handleQueryResponse(
            () => this.service.get_minter_info(),
            (resp) => ({ minimumDepositAmount: resp.minimum_deposit_amount }),
        ));
    }
}
