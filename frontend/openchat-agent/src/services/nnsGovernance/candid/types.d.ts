import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface Ballot { 'vote' : number, 'voting_power' : bigint }
export type Command = { 'RegisterVote' : RegisterVote };
export type Command_1 = { 'Error' : GovernanceError } |
  { 'RegisterVote' : {} };
export interface GovernanceError {
  'error_message' : string,
  'error_type' : number,
}
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
export interface ManageNeuron {
  'id' : [] | [NeuronId],
  'command' : [] | [Command],
}
export interface ManageNeuronResponse { 'command' : [] | [Command_1] }
export interface NeuronId { 'id' : bigint }
export interface ProposalInfo {
  'id' : [] | [NeuronId],
  'ballots' : Array<[bigint, Ballot]>,
  'latest_tally' : [] | [Tally],
}
export interface RegisterVote { 'vote' : number, 'proposal' : [] | [NeuronId] }
export interface Tally {
  'no' : bigint,
  'yes' : bigint,
  'total' : bigint,
  'timestamp_seconds' : bigint,
}
export interface _SERVICE {
  'list_proposals' : ActorMethod<[ListProposalInfo], ListProposalInfoResponse>,
  'manage_neuron' : ActorMethod<[ManageNeuron], ManageNeuronResponse>,
}
