import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface PendingUtxo {
  'confirmations' : number,
  'value' : bigint,
  'outpoint' : { 'txid' : Uint8Array | number[], 'vout' : number },
}
export type UpdateBalanceError = {
    'GenericError' : { 'error_message' : string, 'error_code' : bigint }
  } |
  { 'TemporarilyUnavailable' : string } |
  { 'AlreadyProcessing' : null } |
  {
    'NoNewUtxos' : {
      'required_confirmations' : number,
      'pending_utxos' : [] | [Array<PendingUtxo>],
      'current_confirmations' : [] | [number],
    }
  };
export interface Utxo {
  'height' : number,
  'value' : bigint,
  'outpoint' : { 'txid' : Uint8Array | number[], 'vout' : number },
}
export type UtxoStatus = { 'ValueTooSmall' : Utxo } |
  { 'Tainted' : Utxo } |
  {
    'Minted' : {
      'minted_amount' : bigint,
      'block_index' : bigint,
      'utxo' : Utxo,
    }
  } |
  { 'Checked' : Utxo };
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
  'update_balance' : ActorMethod<
    [
      {
        'owner' : [] | [Principal],
        'subaccount' : [] | [Uint8Array | number[]],
      },
    ],
    { 'Ok' : Array<UtxoStatus> } |
      { 'Err' : UpdateBalanceError }
  >,
}
