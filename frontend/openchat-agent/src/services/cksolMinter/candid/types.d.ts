import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

/**
 * A Solana address, base58-encoded
 */
export type Address = string;
/**
 * Smallest denomination of SOL, the native token on Solana,
 * i.e. 1_000_000_000 Lamports is 1 SOL
 */
export type Lamport = bigint;
/**
 * The index of the ckSOL ledger's burn transaction for a withdrawal
 */
export type LedgerBurnIndex = bigint;
/**
 * Information about the ckSOL minter canister.
 */
export interface MinterInfo {
  'withdrawal_fee' : Lamport,
  'minimum_deposit_amount' : Lamport,
  'minimum_withdrawal_amount' : Lamport,
}
export interface WithdrawSolArgs {
  /**
   * The subaccount to burn ckSOL from.
   */
  'from_subaccount' : [] | [Uint8Array | number[]],
  /**
   * The address to which the ckSOL minter should deposit Solana tokens.
   */
  'address' : Address,
  /**
   * The amount of ckSOL in Lamports that the client wants to withdraw.
   */
  'amount' : Lamport,
}
export type WithdrawSolError = {
    /**
     * The minter failed to parse the destination address.
     */
    'MalformedAddress' : Address
  } |
  {
    /**
     * The withdrawal amount is too low.
     */
    'ValueTooSmall' : {
      /**
       * The requested withdrawal amount.
       */
      'withdrawal_amount' : Lamport,
      /**
       * The minimum withdrawal amount.
       */
      'minimum_withdrawal_amount' : Lamport,
    }
  } |
  {
    /**
     * The minter is overloaded, retry the request.
     * The payload contains a human-readable message explaining what caused the unavailability.
     */
    'TemporarilyUnavailable' : string
  } |
  {
    /**
     * The destination address is not a valid withdrawal destination.
     * The payload contains a human-readable message explaining why the destination was rejected.
     */
    'InvalidDestination' : string
  } |
  {
    /**
     * The minter is not approved to transfer the requested amount.
     */
    'InsufficientAllowance' : { 'allowance' : Lamport }
  } |
  {
    /**
     * The minter is already processing another retrieval request for the same
     * principal.
     */
    'AlreadyProcessing' : null
  } |
  {
    /**
     * The ckSOL balance of the withdrawal account is too low.
     */
    'InsufficientFunds' : { 'balance' : Lamport }
  };
export interface WithdrawSolOk {
  /**
   * Returns the burn transaction index corresponding to the withdrawal.
   * You can use this index to query the withdrawal status.
   */
  'block_index' : LedgerBurnIndex,
}
/**
 * The result of a call to the `withdraw_sol` endpoint.
 */
export type WithdrawSolResult = { 'Ok' : WithdrawSolOk } |
  { 'Err' : WithdrawSolError };
export interface _SERVICE {
  /**
   * Returns information about the ckSOL minter canister.
   */
  'get_minter_info' : ActorMethod<[], MinterInfo>,
  /**
   * Submits a request to convert ckSOL to Solana.
   */
  'withdraw_sol' : ActorMethod<[WithdrawSolArgs], WithdrawSolResult>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
