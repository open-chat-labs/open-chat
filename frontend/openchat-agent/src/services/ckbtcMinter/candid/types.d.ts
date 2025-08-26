import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface MinterInfo {
  'retrieve_btc_min_amount' : bigint,
  'min_confirmations' : number,
  'kyt_fee' : bigint,
}
export interface Utxo {
  'height' : number,
  'value' : bigint,
  'outpoint' : { 'txid' : Uint8Array | number[], 'vout' : number },
}
export interface _SERVICE {
  'estimate_withdrawal_fee' : ActorMethod<
    [{ 'amount' : [] | [bigint] }],
    { 'minter_fee' : bigint, 'bitcoin_fee' : bigint }
  >,
  'get_deposit_fee' : ActorMethod<[], bigint>,
  'get_known_utxos' : ActorMethod<
    [
      {
        'owner' : [] | [Principal],
        'subaccount' : [] | [Uint8Array | number[]],
      },
    ],
    Array<Utxo>
  >,
  'get_minter_info' : ActorMethod<[], MinterInfo>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
