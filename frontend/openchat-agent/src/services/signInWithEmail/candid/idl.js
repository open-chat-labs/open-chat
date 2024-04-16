export const idlFactory = ({ IDL }) => {
  const GenerateVerificationCodeArgs = IDL.Record({ 'email' : IDL.Text });
  const GenerateVerificationCodeResponse = IDL.Variant({
    'Blocked' : IDL.Nat64,
    'EmailInvalid' : IDL.Null,
    'FailedToSendEmail' : IDL.Text,
    'Success' : IDL.Null,
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
  const SubmitVerificationCodeArgs = IDL.Record({
    'session_key' : IDL.Vec(IDL.Nat8),
    'code' : IDL.Text,
    'email' : IDL.Text,
    'max_time_to_live' : IDL.Opt(IDL.Nat64),
  });
  const SubmitVerificationCodeSuccess = IDL.Record({
    'user_key' : IDL.Vec(IDL.Nat8),
    'expiration' : IDL.Nat64,
  });
  const SubmitVerificationCodeResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : SubmitVerificationCodeSuccess,
    'IncorrectCode' : IDL.Null,
  });
  return IDL.Service({
    'generate_verification_code' : IDL.Func(
        [GenerateVerificationCodeArgs],
        [GenerateVerificationCodeResponse],
        [],
      ),
    'get_delegation' : IDL.Func(
        [GetDelegationArgs],
        [GetDelegationResponse],
        ['query'],
      ),
    'rsa_public_key' : IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    'submit_verification_code' : IDL.Func(
        [SubmitVerificationCodeArgs],
        [SubmitVerificationCodeResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
