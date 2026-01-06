import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

/**
 * / A general address that can be either an EVM address or an ICP address.
 */
export type Account = { 'Evm' : EvmAccount } |
  { 'Icp' : IcpAccount };
/**
 * / A general representation of tokens being transferred.
 */
export interface AssetInfo {
  /**
   * / If token are sent from EVM, then this contains the lock or burn
   * / transaction and the log index of the corresponding event log.
   */
  'tx' : [] | [Tx],
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new tokens.
   */
  'token' : [] | [Token],
  /**
   * / The source chain.
   * / This field is marked as optional for backwards compatibility when adding
   * / new account chains.
   */
  'chain' : [] | [Chain],
  /**
   * / The sender.
   * / This field is marked as optional for backwards compatibility when adding
   * / new account types.
   */
  'account' : [] | [Account],
  /**
   * / The amount of tokens represented in the smallest units of the token.
   */
  'amount' : bigint,
}
/**
 * / Supported blockchains.
 */
export type Chain = { 'ICP' : null } |
  { 'Base' : null } |
  { 'Ethereum' : null } |
  { 'Arbitrum' : null };
export interface ErrorMessage { 'error' : string }
/**
 * / An EVM address represented as a hex-string.
 */
export interface EvmAccount { 'address' : string }
/**
 * / Supported EVM-compatible blockchains.
 */
export type EvmChain = { 'Base' : null } |
  { 'Ethereum' : null } |
  { 'Arbitrum' : null };
/**
 * / An EVM transaction hash with an optional log index.
 */
export interface EvmTx { 'log_index' : [] | [bigint], 'hash' : string }
/**
 * / The argument of the `forward_evm_to_icp` endpoint.
 * / Specifies that the given tokens have been transferred to the given
 * / forwarding address and are ready to be transferred from EVM To ICP.
 */
export interface ForwardEvmToIcpArg {
  /**
   * / The token being transferred.
   */
  'token' : Token,
  /**
   * / The source EVM chain.
   */
  'chain' : EvmChain,
  /**
   * / The source forwarding address on the EVM side.
   */
  'address' : string,
  /**
   * / The receiver on the ICP side.
   */
  'receiver' : IcpAccount,
}
/**
 * / A result of the `forward_evm_to_icp` endpoint.
 */
export interface ForwardingResponse {
  /**
   * / The status of the new forwarding operation.
   * / This field is marked as optional for backwards compatibility when adding
   * / new status cases.
   */
  'status' : [] | [ForwardingStatus],
  /**
   * / The result of the last completed forwarding operation.
   * / It is the id of the transfer initiated by forwarding.
   */
  'done' : [] | [TransferId],
}
/**
 * / The status of forwarding tokens from the forwarding address to bridging.
 */
export type ForwardingStatus = {
    /**
     * / The balance has been checked, but it is lower than the minimum amount.
     */
    'LowBalance' : { 'balance' : bigint, 'min_amount' : bigint }
  } |
  {
    /**
     * / The forwarding request has been received, but the balance of the
     * / forwarding address hasn't been checked yet.
     */
    'CheckingBalance' : null
  } |
  {
    /**
     * / The tokens are being forwarded for bridging.
     */
    'Forwarding' : null
  } |
  {
    /**
     * / The tokens have been forwarded and the given transaction has initiated
     * / the EVM to ICP transfer.
     */
    'Forwarded' : EvmTx
  };
/**
 * / An ICP address that is either an ICRC2 account or a legacy ICP ledger
 * / specific account identifier.
 */
export type IcpAccount = {
    'ICRC' : {
      'owner' : Principal,
      'subaccount' : [] | [Uint8Array | number[]],
    }
  } |
  { 'AccountId' : string };
/**
 * / An ICRC2 ledger transaction.
 */
export interface IcpTx { 'block_index' : bigint, 'ledger' : Principal }
export type Result = { 'Ok' : null } |
  { 'Err' : string };
/**
 * / Transfer status.
 */
export type Status = { 'Failed' : ErrorMessage } |
  { 'Refunded' : Tx } |
  { 'PendingRefundTx' : null } |
  { 'PendingDestinationTx' : null } |
  { 'Succeeded' : null } |
  { 'PendingSourceTx' : null };
/**
 * / Supported tokens.
 */
export type Token = { 'BOB' : null } |
  { 'ICP' : null } |
  { 'GLDT' : null } |
  { 'USDC' : null } |
  { 'USDT' : null } |
  { 'cbBTC' : null } |
  { 'ckBTC' : null };
export interface Trace { 'entries' : Array<TraceEntry> }
export interface TraceEntry {
  'tx' : [] | [Tx],
  'end' : [] | [bigint],
  'result' : [] | [Result],
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new chains.
   */
  'chain' : [] | [Chain],
  'block_number' : [] | [bigint],
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new trace events.
   */
  'event' : [] | [TraceEvent],
  'start' : bigint,
}
export type TraceEvent = { 'PendingConfirmTx' : null } |
  { 'ConfirmTx' : null } |
  { 'SendTx' : null } |
  { 'FetchTx' : null } |
  { 'SignTx' : null };
/**
 * / General information about a transfer.
 */
export interface Transfer {
  'end' : [] | [bigint],
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new status cases.
   */
  'status' : [] | [Status],
  'destination' : AssetInfo,
  'trace' : Trace,
  'source' : AssetInfo,
  'start' : [] | [bigint],
  'queue_position' : [] | [bigint],
}
export interface TransferFee {
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new chains.
   */
  'source_chain' : [] | [Chain],
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new chain.
   */
  'destination_chain' : [] | [Chain],
  'latest_transfer_fee_in_tokens' : bigint,
  'min_amount' : bigint,
  'average_transfer_fee_in_tokens' : bigint,
  'available' : [] | [bigint],
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new tokens.
   */
  'source_token' : [] | [Token],
  'max_amount' : bigint,
  'protocol_fee_in_percent' : number,
  /**
   * / This field is marked as optional for backwards compatibility when adding
   * / new tokens.
   */
  'destination_token' : [] | [Token],
}
/**
 * / The unique identifier of an accepted transfer.
 */
export interface TransferId { 'id' : bigint }
/**
 * / A general transaction that can be either an EVM transaction or an ICP
 * / transaction.
 */
export type Tx = { 'Evm' : EvmTx } |
  { 'Icp' : IcpTx };
export interface _SERVICE {
  /**
   * / Starts a transfer of tokens from EVM to ICP using a forwarding address.
   * / To get the lowest latency, call this endpoint after tokens have been
   * / transferred to the forwarding address.
   * /
   * / See comments of `ForwardEvmToIcpArg` for more details.
   */
  'forward_evm_to_icp' : ActorMethod<
    [ForwardEvmToIcpArg],
    { 'Ok' : ForwardingResponse } |
      { 'Err' : string }
  >,
  'get_forwarding_status' : ActorMethod<
    [ForwardEvmToIcpArg],
    { 'Ok' : ForwardingResponse } |
      { 'Err' : string }
  >,
  /**
   * / Returns information about a transfer by its id.
   */
  'get_transfer' : ActorMethod<
    [TransferId],
    { 'Ok' : Transfer } |
      { 'Err' : string }
  >,
  /**
   * / Returns the current transfer fees and additional information such as the
   * / minimum and maximum supported amounts per chain and token.
   */
  'get_transfer_fees' : ActorMethod<[], Array<TransferFee>>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
