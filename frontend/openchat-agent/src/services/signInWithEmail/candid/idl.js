export const idlFactory = ({ IDL }) => {
  const GenerateMagicLinkArgs = IDL.Record({
    'session_key' : IDL.Vec(IDL.Nat8),
    'email' : IDL.Text,
    'max_time_to_live' : IDL.Opt(IDL.Nat64),
  });
  const GenerateMagicLinkSuccess = IDL.Record({
    'created' : IDL.Nat64,
    'user_key' : IDL.Vec(IDL.Nat8),
    'expiration' : IDL.Nat64,
  });
  const GenerateMagicLinkResponse = IDL.Variant({
    'Blocked' : IDL.Nat64,
    'EmailInvalid' : IDL.Null,
    'FailedToSendEmail' : IDL.Text,
    'Success' : GenerateMagicLinkSuccess,
  });
  const GetDelegationArgs = IDL.Record({
    'session_key' : IDL.Vec(IDL.Nat8),
    'email' : IDL.Text,
    'expiration' : IDL.Nat64,
  });
  const Delegation = IDL.Record({
    'pubkey' : IDL.Vec(IDL.Nat8),
    'expiration' : IDL.Nat64,
  });
  const SignedDelegation = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'delegation' : Delegation,
  });
  const GetDelegationResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : SignedDelegation,
  });
  const HandleMagicLinkArgs = IDL.Record({ 'link' : IDL.Text });
  const HandleMagicLinkResponse = IDL.Variant({
    'Success' : IDL.Null,
    'LinkExpired' : IDL.Null,
    'LinkInvalid' : IDL.Text,
  });
  return IDL.Service({
    'generate_magic_link' : IDL.Func(
        [GenerateMagicLinkArgs],
        [GenerateMagicLinkResponse],
        [],
      ),
    'get_delegation' : IDL.Func(
        [GetDelegationArgs],
        [GetDelegationResponse],
        ['query'],
      ),
    'handle_magic_link' : IDL.Func(
        [HandleMagicLinkArgs],
        [HandleMagicLinkResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
