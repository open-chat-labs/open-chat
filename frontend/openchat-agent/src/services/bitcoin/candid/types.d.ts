import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type address = string;
export type block_hash = Uint8Array | number[];
export type block_height = number;
export interface get_utxos_request {
  'network' : network,
  'filter' : [] | [
    { 'page' : Uint8Array | number[] } |
      { 'min_confirmations' : number }
  ],
  'address' : address,
}
export interface get_utxos_response {
  'next_page' : [] | [Uint8Array | number[]],
  'tip_height' : block_height,
  'tip_block_hash' : block_hash,
  'utxos' : Array<utxo>,
}
export type network = { 'mainnet' : null } |
  { 'regtest' : null } |
  { 'testnet' : null };
export interface outpoint { 'txid' : Uint8Array | number[], 'vout' : number }
export type satoshi = bigint;
export interface utxo {
  'height' : block_height,
  'value' : satoshi,
  'outpoint' : outpoint,
}
export interface _SERVICE {
  'bitcoin_get_utxos_query' : ActorMethod<
    [get_utxos_request],
    get_utxos_response
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
