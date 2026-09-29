import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { idlFactory, type CkbtcMinterService } from "./candid/idl";
import { utxo } from "../bitcoin/mappers";
import type { CkbtcMinterDepositInfo, CkbtcMinterWithdrawalInfo, IcrcAccount, Utxo } from "@shared";
import { identity } from "../../utils/mapping";
import { apiIcrcAccount } from "../../utils/icrcAccount";

const MAINNET_CKBTC_MINTER_CANISTER_ID = "mqygn-kiaaa-aaaar-qaadq-cai";
const TESTNET_CKBTC_MINTER_CANISTER_ID = "ml52i-qqaaa-aaaar-qaaba-cai";

export class CkbtcMinterClient extends CandidCanisterAgent<CkbtcMinterService> {
    #cachedMinterInfo: CkbtcMinterInfo | undefined;

    constructor(identity: Identity, agent: HttpAgent, mainnetEnabled: boolean) {
        super(
            identity,
            agent,
            mainnetEnabled ? MAINNET_CKBTC_MINTER_CANISTER_ID : TESTNET_CKBTC_MINTER_CANISTER_ID,
            idlFactory,
            "CkbtcMinter",
        );
    }

    getKnownUtxos(account: IcrcAccount): Promise<Utxo[]> {
        // The minter derives each BTC address from an (owner, subaccount) pair, so this has to
        // name the same account the user's canister generated the address for
        const { owner, subaccount } = apiIcrcAccount(account);
        return this.handleQueryResponse(
            () => this.service.get_known_utxos({ owner: [owner], subaccount }),
            (resp) => resp.map(utxo),
        );
    }

    async getDepositInfo(): Promise<CkbtcMinterDepositInfo> {
        const minConfirmationsPromise = this.getMinterInfoCached().then((i) => i.minConfirmations);
        const depositFeePromise = this.handleQueryResponse(
            () => this.service.get_deposit_fee(),
            identity,
        );

        const [minConfirmations, depositFee] = await Promise.all([
            minConfirmationsPromise,
            depositFeePromise,
        ]);

        return {
            minConfirmations,
            depositFee,
        };
    }

    async getWithdrawalInfo(amount: bigint): Promise<CkbtcMinterWithdrawalInfo> {
        const { minWithdrawalAmount } = await this.getMinterInfoCached();

        // The minter traps on 0 ("withdrawal amount is too large", as no UTXOs are selected), on
        // a small amount under its minimum ("withdrawal amount is too low") and on more than all
        // its UTXOs together ("withdrawal amount is too large"). The send form asks for an
        // estimate with 0 on open and again on every keystroke, so those amounts are routine.
        // Fall back to the minter's amount-independent estimate for them.
        const feeEstimate = await (amount >= minWithdrawalAmount
            ? this.estimateWithdrawalFee(amount).catch((err) => {
                  if (String(err?.message).includes("withdrawal amount is too large")) {
                      return this.estimateWithdrawalFee(undefined);
                  }
                  throw err;
              })
            : this.estimateWithdrawalFee(undefined));

        return {
            minWithdrawalAmount,
            feeEstimate,
        };
    }

    private estimateWithdrawalFee(amount: bigint | undefined): Promise<bigint> {
        return this.handleQueryResponse(
            () =>
                this.service.estimate_withdrawal_fee({
                    amount: amount === undefined ? [] : [amount],
                }),
            (resp) => resp.minter_fee + resp.bitcoin_fee,
        );
    }

    private async getMinterInfoCached(): Promise<CkbtcMinterInfo> {
        return (this.#cachedMinterInfo ??= await this.getMinterInfo());
    }

    private getMinterInfo(): Promise<CkbtcMinterInfo> {
        return this.handleQueryResponse(
            () => this.service.get_minter_info(),
            (resp) => ({
                minConfirmations: resp.min_confirmations,
                minWithdrawalAmount: resp.retrieve_btc_min_amount,
            }),
        );
    }
}

type CkbtcMinterInfo = {
    minConfirmations: number;
    minWithdrawalAmount: bigint;
};
