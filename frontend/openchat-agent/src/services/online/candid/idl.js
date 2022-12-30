export const idlFactory = ({ IDL }) => {
  const CanisterId = IDL.Principal;
  const UserId = CanisterId;
  const LastOnlineArgs = IDL.Record({ 'user_ids' : IDL.Vec(UserId) });
  const Milliseconds = IDL.Nat64;
  const LastOnlineResponse = IDL.Variant({
    'Success' : IDL.Vec(
      IDL.Record({
        'user_id' : UserId,
        'duration_since_last_online' : Milliseconds,
      })
    ),
  });
  const MarkAsOnlineArgs = IDL.Record({});
  const MarkAsOnlineResponse = IDL.Variant({
    'Success' : IDL.Null,
    'InternalError' : IDL.Text,
    'UserNotFound' : IDL.Null,
  });
  return IDL.Service({
    'last_online' : IDL.Func([LastOnlineArgs], [LastOnlineResponse], ['query']),
    'mark_as_online' : IDL.Func([MarkAsOnlineArgs], [MarkAsOnlineResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
