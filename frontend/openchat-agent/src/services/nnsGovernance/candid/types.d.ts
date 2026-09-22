import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface Ballot { 'vote' : number, 'voting_power' : bigint }
export type Command = { 'RegisterVote' : RegisterVote };
export type Command_1 = { 'Error' : GovernanceError } |
  { 'RegisterVote' : {} };
export type DissolveState = { 'DissolveDelaySeconds' : bigint } |
  { 'WhenDissolvedTimestampSeconds' : bigint };
export interface GovernanceError {
  'error_message' : string,
  'error_type' : number,
}
export interface ListNeurons {
  'neuron_ids' : BigUint64Array | bigint[],
  'include_neurons_readable_by_caller' : boolean,
  'include_empty_neurons_readable_by_caller' : [] | [boolean],
  'include_public_neurons_in_full_neurons' : [] | [boolean],
  'page_number' : [] | [bigint],
  'page_size' : [] | [bigint],
}
export interface ListNeuronsResponse {
  'full_neurons' : Array<Neuron>,
  'total_pages_available' : [] | [bigint],
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
export interface Neuron {
  'id' : [] | [NeuronId],
  'dissolve_state' : [] | [DissolveState],
}
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
  'list_neurons' : ActorMethod<[ListNeurons], ListNeuronsResponse>,
  'list_proposals' : ActorMethod<[ListProposalInfo], ListProposalInfoResponse>,
  'manage_neuron' : ActorMethod<[ManageNeuron], ManageNeuronResponse>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
