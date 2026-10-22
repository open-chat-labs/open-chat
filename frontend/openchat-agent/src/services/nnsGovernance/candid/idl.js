export const idlFactory = ({ IDL }) => {
  const VotingPowerEconomics = IDL.Record({
    'neuron_minimum_dissolve_delay_to_vote_seconds' : IDL.Opt(IDL.Nat64),
  });
  const NetworkEconomics = IDL.Record({
    'voting_power_economics' : IDL.Opt(VotingPowerEconomics),
  });
  const ListNeurons = IDL.Record({
    'page_size' : IDL.Opt(IDL.Nat64),
    'include_public_neurons_in_full_neurons' : IDL.Opt(IDL.Bool),
    'neuron_ids' : IDL.Vec(IDL.Nat64),
    'page_number' : IDL.Opt(IDL.Nat64),
    'include_empty_neurons_readable_by_caller' : IDL.Opt(IDL.Bool),
    'include_neurons_readable_by_caller' : IDL.Bool,
  });
  const NeuronId = IDL.Record({ 'id' : IDL.Nat64 });
  const DissolveState = IDL.Variant({
    'DissolveDelaySeconds' : IDL.Nat64,
    'WhenDissolvedTimestampSeconds' : IDL.Nat64,
  });
  const Neuron = IDL.Record({
    'id' : IDL.Opt(NeuronId),
    'dissolve_state' : IDL.Opt(DissolveState),
  });
  const ListNeuronsResponse = IDL.Record({
    'full_neurons' : IDL.Vec(Neuron),
    'total_pages_available' : IDL.Opt(IDL.Nat64),
  });
  const ListProposalInfo = IDL.Record({
    'include_reward_status' : IDL.Vec(IDL.Int32),
    'before_proposal' : IDL.Opt(NeuronId),
    'limit' : IDL.Nat32,
    'exclude_topic' : IDL.Vec(IDL.Int32),
    'include_status' : IDL.Vec(IDL.Int32),
  });
  const Ballot = IDL.Record({ 'vote' : IDL.Int32, 'voting_power' : IDL.Nat64 });
  const Tally = IDL.Record({
    'no' : IDL.Nat64,
    'yes' : IDL.Nat64,
    'total' : IDL.Nat64,
    'timestamp_seconds' : IDL.Nat64,
  });
  const ProposalInfo = IDL.Record({
    'id' : IDL.Opt(NeuronId),
    'ballots' : IDL.Vec(IDL.Tuple(IDL.Nat64, Ballot)),
    'latest_tally' : IDL.Opt(Tally),
  });
  const ListProposalInfoResponse = IDL.Record({
    'proposal_info' : IDL.Vec(ProposalInfo),
  });
  const RegisterVote = IDL.Record({
    'vote' : IDL.Int32,
    'proposal' : IDL.Opt(NeuronId),
  });
  const Command = IDL.Variant({ 'RegisterVote' : RegisterVote });
  const ManageNeuron = IDL.Record({
    'id' : IDL.Opt(NeuronId),
    'command' : IDL.Opt(Command),
  });
  const GovernanceError = IDL.Record({
    'error_message' : IDL.Text,
    'error_type' : IDL.Int32,
  });
  const Command_1 = IDL.Variant({
    'Error' : GovernanceError,
    'RegisterVote' : IDL.Record({}),
  });
  const ManageNeuronResponse = IDL.Record({ 'command' : IDL.Opt(Command_1) });
  return IDL.Service({
    'get_network_economics_parameters' : IDL.Func(
        [],
        [NetworkEconomics],
        ['query'],
      ),
    'list_neurons' : IDL.Func([ListNeurons], [ListNeuronsResponse], ['query']),
    'list_proposals' : IDL.Func(
        [ListProposalInfo],
        [ListProposalInfoResponse],
        ['query'],
      ),
    'manage_neuron' : IDL.Func([ManageNeuron], [ManageNeuronResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
