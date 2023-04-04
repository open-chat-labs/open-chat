import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface Ballot { 'vote' : number, 'voting_power' : bigint }
export interface ListProposalInfo {
  'include_reward_status' : Int32Array | number[],
  'before_proposal' : [] | [NeuronId],
  'limit' : number,
  'exclude_topic' : Int32Array | number[],
  'include_status' : Int32Array | number[],
}
export interface ListProposalInfoResponse {
  'proposal_info' : Array<ProposalInfo>,
}
export interface NeuronId { 'id' : bigint }
export interface ProposalInfo {
  'id' : [] | [NeuronId],
  'ballots' : Array<[bigint, Ballot]>,
  'latest_tally' : [] | [Tally],
}
export interface Tally {
  'no' : bigint,
  'yes' : bigint,
  'total' : bigint,
  'timestamp_seconds' : bigint,
}
export interface _SERVICE {
  'list_proposals' : ActorMethod<[ListProposalInfo], ListProposalInfoResponse>,
}
