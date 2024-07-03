export const idlFactory = ({ IDL }) => {
  const GenerateMagicLinkArgs = IDL.Record({
    'session_key' : IDL.Vec(IDL.Nat8),
    'email' : IDL.Text,
    'max_time_to_live' : IDL.Opt(IDL.Nat64),
  });
  const GenerateMagicLinkSuccess = IDL.Record({
    'created' : IDL.Nat64,
    'user_key' : IDL.Vec(IDL.Nat8),
    'code' : IDL.Text,
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
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
  });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'upgrade' : IDL.Opt(IDL.Bool),
    'status_code' : IDL.Nat16,
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
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'http_request_update' : IDL.Func([HttpRequest], [HttpResponse], []),
    'rsa_public_key' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
