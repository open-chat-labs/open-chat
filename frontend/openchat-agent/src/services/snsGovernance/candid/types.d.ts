import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type FunctionType = { 'NativeNervousSystemFunction' : {} } |
  { 'GenericNervousSystemFunction' : GenericNervousSystemFunction };
export interface GenericNervousSystemFunction {
  'validator_canister_id' : [] | [Principal],
  'target_canister_id' : [] | [Principal],
  'validator_method_name' : [] | [string],
  'target_method_name' : [] | [string],
}
export interface GovernanceError {
  'error_message' : string,
  'error_type' : number,
}
export interface ListNervousSystemFunctionsResponse {
  'reserved_ids' : BigUint64Array | bigint[],
  'functions' : Array<NervousSystemFunction>,
}
export interface ListProposals {
  'include_reward_status' : Int32Array | number[],
  'before_proposal' : [] | [ProposalId],
  'limit' : number,
  'exclude_type' : BigUint64Array | bigint[],
  'include_status' : Int32Array | number[],
}
export interface ListProposalsResponse { 'proposals' : Array<ProposalData> }
export interface NervousSystemFunction {
  'id' : bigint,
  'name' : string,
  'description' : [] | [string],
  'function_type' : [] | [FunctionType],
}
export interface ProposalData {
  'id' : [] | [ProposalId],
  'latest_tally' : [] | [Tally],
}
export interface ProposalId { 'id' : bigint }
export interface Tally {
  'no' : bigint,
  'yes' : bigint,
  'total' : bigint,
  'timestamp_seconds' : bigint,
}
export interface _SERVICE {
  'list_nervous_system_functions' : ActorMethod<
    [],
    ListNervousSystemFunctionsResponse
  >,
  'list_proposals' : ActorMethod<[ListProposals], ListProposalsResponse>,
}
