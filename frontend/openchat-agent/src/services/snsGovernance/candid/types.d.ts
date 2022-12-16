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
export interface GetProposal { 'proposal_id' : [] | [ProposalId] }
export interface GetProposalResponse { 'result' : [] | [GetProposalResult] }
export type GetProposalResult = { 'Error' : GovernanceError } |
  { 'Proposal' : ProposalDataTrimmed };
export interface GovernanceError {
  'error_message' : string,
  'error_type' : number,
}
export interface ListNervousSystemFunctionsResponse {
  'reserved_ids' : BigUint64Array | bigint[],
  'functions' : Array<NervousSystemFunction>,
}
export interface NervousSystemFunction {
  'id' : bigint,
  'name' : string,
  'description' : [] | [string],
  'function_type' : [] | [FunctionType],
}
export interface ProposalDataTrimmed { 'latest_tally' : [] | [Tally] }
export interface ProposalId { 'id' : bigint }
export interface Tally {
  'no' : bigint,
  'yes' : bigint,
  'total' : bigint,
  'timestamp_seconds' : bigint,
}
export interface _SERVICE {
  'get_proposal' : ActorMethod<[GetProposal], GetProposalResponse>,
  'list_nervous_system_functions' : ActorMethod<
    [],
    ListNervousSystemFunctionsResponse
  >,
}
