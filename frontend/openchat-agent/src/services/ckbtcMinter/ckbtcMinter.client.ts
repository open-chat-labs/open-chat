import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { idlFactory, type CkbtcMinterService } from "./candid/idl";
import { utxo } from "../bitcoin/mappers";
import type { CkbtcMinterDepositInfo, Utxo } from "openchat-shared";
import { identity } from "../../utils/mapping";

const MAINNET_CKBTC_MINTER_CANISTER_ID = "mqygn-kiaaa-aaaar-qaadq-cai";
const TESTNET_CKBTC_MINTER_CANISTER_ID = "ml52i-qqaaa-aaaar-qaaba-cai";

export class CkbtcMinterClient extends CandidCanisterAgent<CkbtcMinterService> {
    constructor(identity: Identity, agent: HttpAgent, mainnetEnabled: boolean) {
        super(
            identity,
            agent,
            mainnetEnabled ? MAINNET_CKBTC_MINTER_CANISTER_ID : TESTNET_CKBTC_MINTER_CANISTER_ID,
            idlFactory,
            "CkbtcMinter"
        );
    }

    getKnownUtxos(userId: string): Promise<Utxo[]> {
        return this.handleQueryResponse(
            () => this.service.get_known_utxos({
                owner: [Principal.fromText(userId)],
                subaccount: [],
            }),
            (resp) => resp.map(utxo),
        );
    }

    async getDepositInfo(): Promise<CkbtcMinterDepositInfo> {
        const minConfirmationsPromise = this.handleQueryResponse(
            () => this.service.get_minter_info(),
            (resp) => resp.min_confirmations
        );
        const depositFeePromise = this.handleQueryResponse(
            () => this.service.get_deposit_fee(),
            identity
        );

        const [minConfirmations, depositFee] = await Promise.all([minConfirmationsPromise, depositFeePromise]);

        return {
            minConfirmations,
            depositFee,
        }
    }

    getWithdrawalFeeEstimate(amount: bigint): Promise<bigint> {
        return this.handleQueryResponse(
            () => this.service.estimate_withdrawal_fee({ amount: [amount] }),
            (resp) => resp.minter_fee + resp.bitcoin_fee,
        )
    }
}
