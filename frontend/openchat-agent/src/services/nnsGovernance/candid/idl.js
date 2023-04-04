export const idlFactory = ({ IDL }) => {
  const NeuronId = IDL.Record({ 'id' : IDL.Nat64 });
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
  return IDL.Service({
    'list_proposals' : IDL.Func(
        [ListProposalInfo],
        [ListProposalInfoResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
