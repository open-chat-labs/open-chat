export const idlFactory = ({ IDL }) => {
  const PublicKey = IDL.Vec(IDL.Nat8);
  const TimestampNanoseconds = IDL.Nat64;
  const SignedDelegation = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'delegation' : IDL.Record({
      'pubkey' : PublicKey,
      'expiration' : TimestampNanoseconds,
    }),
  });
  const ApproveIdentityLinkArgs = IDL.Record({
    'link_initiated_by' : IDL.Principal,
    'public_key' : IDL.Vec(IDL.Nat8),
    'delegation' : SignedDelegation,
  });
  const ApproveIdentityLinkResponse = IDL.Variant({
    'LinkRequestNotFound' : IDL.Null,
    'InvalidSignature' : IDL.Null,
    'PrincipalAlreadyLinkedToAnotherOcUser' : IDL.Null,
    'Success' : IDL.Null,
    'MalformedSignature' : IDL.Text,
    'DelegationTooOld' : IDL.Null,
    'CallerNotRecognised' : IDL.Null,
  });
  const AuthPrincipalsResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Vec(
      IDL.Record({
        'principal' : IDL.Principal,
        'originating_canister' : IDL.Principal,
        'is_ii_principal' : IDL.Bool,
      })
    ),
  });
  const CheckAuthPrincipalResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Null,
  });
  const Nanoseconds = IDL.Nat64;
  const CreateIdentityArgs = IDL.Record({
    'public_key' : PublicKey,
    'session_key' : PublicKey,
    'max_time_to_live' : IDL.Opt(Nanoseconds),
    'is_ii_principal' : IDL.Opt(IDL.Bool),
    'challenge_attempt' : IDL.Opt(
      IDL.Record({ 'key' : IDL.Nat32, 'chars' : IDL.Text })
    ),
  });
  const PrepareDelegationSuccess = IDL.Record({
    'user_key' : PublicKey,
    'expiration' : TimestampNanoseconds,
  });
  const CreateIdentityResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'OriginatingCanisterInvalid' : IDL.Principal,
    'Success' : PrepareDelegationSuccess,
    'ChallengeFailed' : IDL.Null,
    'ChallengeRequired' : IDL.Null,
    'PublicKeyInvalid' : IDL.Text,
  });
  const GenerateChallengeResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'Throttled' : IDL.Null,
    'Success' : IDL.Record({ 'key' : IDL.Nat32, 'png_base64' : IDL.Text }),
  });
  const GetDelegationArgs = IDL.Record({
    'session_key' : PublicKey,
    'expiration' : TimestampNanoseconds,
  });
  const GetDelegationResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : SignedDelegation,
  });
  const InitiateIdentityLinkArgs = IDL.Record({
    'public_key' : IDL.Vec(IDL.Nat8),
    'link_to_principal' : IDL.Principal,
    'is_ii_principal' : IDL.Opt(IDL.Bool),
  });
  const InitiateIdentityLinkResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'Success' : IDL.Null,
    'TargetUserNotFound' : IDL.Null,
    'PublicKeyInvalid' : IDL.Text,
    'AlreadyLinkedToPrincipal' : IDL.Null,
  });
  const PrepareDelegationArgs = IDL.Record({
    'session_key' : PublicKey,
    'max_time_to_live' : IDL.Opt(Nanoseconds),
    'is_ii_principal' : IDL.Opt(IDL.Bool),
  });
  const PrepareDelegationResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : PrepareDelegationSuccess,
  });
  const RemoveIdentityLinkArgs = IDL.Record({
    'linked_principal' : IDL.Principal,
  });
  const RemoveIdentityLinkResponse = IDL.Variant({
    'CannotUnlinkActivePrincipal' : IDL.Null,
    'Success' : IDL.Null,
    'IdentityLinkNotFound' : IDL.Null,
    'UserNotFound' : IDL.Null,
  });
  return IDL.Service({
    'approve_identity_link' : IDL.Func(
        [ApproveIdentityLinkArgs],
        [ApproveIdentityLinkResponse],
        [],
      ),
    'auth_principals' : IDL.Func(
        [IDL.Record({})],
        [AuthPrincipalsResponse],
        ['query'],
      ),
    'check_auth_principal' : IDL.Func(
        [IDL.Record({})],
        [CheckAuthPrincipalResponse],
        ['query'],
      ),
    'create_identity' : IDL.Func(
        [CreateIdentityArgs],
        [CreateIdentityResponse],
        [],
      ),
    'generate_challenge' : IDL.Func(
        [IDL.Record({})],
        [GenerateChallengeResponse],
        [],
      ),
    'get_delegation' : IDL.Func(
        [GetDelegationArgs],
        [GetDelegationResponse],
        ['query'],
      ),
    'initiate_identity_link' : IDL.Func(
        [InitiateIdentityLinkArgs],
        [InitiateIdentityLinkResponse],
        [],
      ),
    'prepare_delegation' : IDL.Func(
        [PrepareDelegationArgs],
        [PrepareDelegationResponse],
        [],
      ),
    'remove_identity_link' : IDL.Func(
        [RemoveIdentityLinkArgs],
        [RemoveIdentityLinkResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
