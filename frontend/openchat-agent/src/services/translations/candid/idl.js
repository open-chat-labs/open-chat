export const idlFactory = ({ IDL }) => {
  const ApproveArgs = IDL.Record({ 'id' : IDL.Nat64 });
  const ApproveResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'NotProposed' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  const TimestampMillis = IDL.Nat64;
  const MarkDeployedArgs = IDL.Record({ 'latest_approval' : TimestampMillis });
  const MarkDeployedResponse = IDL.Variant({ 'Success' : IDL.Null });
  const EmptyArgs = IDL.Record({});
  const Translation = IDL.Record({
    'key' : IDL.Text,
    'value' : IDL.Text,
    'locale' : IDL.Text,
  });
  const PendingDeploymentSuccessResult = IDL.Record({
    'latest_approval' : TimestampMillis,
    'translations' : IDL.Vec(Translation),
  });
  const PendingDeploymentResponse = IDL.Variant({
    'Success' : PendingDeploymentSuccessResult,
  });
  const ProposeArgs = IDL.Record({
    'key' : IDL.Text,
    'value' : IDL.Text,
    'locale' : IDL.Text,
  });
  const ProposeResponse = IDL.Variant({
    'AlreadyProposed' : IDL.Null,
    'Success' : IDL.Nat64,
    'InvalidArgs' : IDL.Text,
    'InternalError' : IDL.Text,
    'UserNotFound' : IDL.Null,
  });
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const CandidateTranslation = IDL.Record({
    'id' : IDL.Nat64,
    'value' : IDL.Text,
    'proposed_at' : TimestampMillis,
    'proposed_by' : UserId,
  });
  const Record = IDL.Record({
    'key' : IDL.Text,
    'locale' : IDL.Text,
    'deployment_count' : IDL.Nat32,
    'candidates' : IDL.Vec(CandidateTranslation),
  });
  const ProposedSuccessResult = IDL.Record({ 'records' : IDL.Vec(Record) });
  const ProposedResponse = IDL.Variant({
    'NotAuthorized' : IDL.Null,
    'Success' : ProposedSuccessResult,
    'InternalError' : IDL.Text,
  });
  const RejectReason = IDL.Variant({
    'TooLong' : IDL.Null,
    'IncorrectMeaning' : IDL.Null,
  });
  const RejectArgs = IDL.Record({ 'id' : IDL.Nat64, 'reason' : RejectReason });
  const RejectResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'NotAuthorized' : IDL.Null,
    'Success' : IDL.Null,
    'NotProposed' : IDL.Null,
    'InternalError' : IDL.Text,
  });
  return IDL.Service({
    'approve' : IDL.Func([ApproveArgs], [ApproveResponse], []),
    'mark_deployed' : IDL.Func([MarkDeployedArgs], [MarkDeployedResponse], []),
    'pending_deployment' : IDL.Func(
        [EmptyArgs],
        [PendingDeploymentResponse],
        ['query'],
      ),
    'propose' : IDL.Func([ProposeArgs], [ProposeResponse], []),
    'proposed' : IDL.Func([EmptyArgs], [ProposedResponse], ['query']),
    'reject' : IDL.Func([RejectArgs], [RejectResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
