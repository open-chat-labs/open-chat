export const idlFactory = ({ IDL }) => {
  const CheckAuthPrincipalResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Null,
    'Legacy' : IDL.Null,
  });
  const PublicKey = IDL.Vec(IDL.Nat8);
  const Nanoseconds = IDL.Nat64;
  const CreateIdentityArgs = IDL.Record({
    'public_key' : PublicKey,
    'session_key' : PublicKey,
    'max_time_to_live' : IDL.Opt(Nanoseconds),
    'challenge_attempt' : IDL.Opt(
      IDL.Record({ 'key' : IDL.Nat32, 'chars' : IDL.Text })
    ),
  });
  const TimestampNanoseconds = IDL.Nat64;
  const CreateIdentityResponse = IDL.Variant({
    'AlreadyRegistered' : IDL.Null,
    'Success' : IDL.Record({
      'principal' : IDL.Principal,
      'user_key' : PublicKey,
      'expiration' : TimestampNanoseconds,
    }),
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
  const SignedDelegation = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'delegation' : IDL.Record({
      'pubkey' : PublicKey,
      'expiration' : TimestampNanoseconds,
    }),
  });
  const GetDelegationResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : SignedDelegation,
  });
  const MigrateLegacyPrincipalResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({ 'new_principal' : IDL.Principal }),
    'InternalError' : IDL.Text,
    'AlreadyMigrated' : IDL.Null,
  });
  const PrepareDelegationArgs = IDL.Record({
    'session_key' : PublicKey,
    'max_time_to_live' : IDL.Opt(Nanoseconds),
  });
  const PrepareDelegationResponse = IDL.Variant({
    'NotFound' : IDL.Null,
    'Success' : IDL.Record({
      'user_key' : PublicKey,
      'expiration' : TimestampNanoseconds,
    }),
  });
  const SetPrincipalMigrationJobEnabledArgs = IDL.Record({
    'enabled' : IDL.Bool,
  });
  const SetPrincipalMigrationJobEnabledResponse = IDL.Variant({
    'Success' : IDL.Null,
  });
  return IDL.Service({
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
    'migrate_legacy_principal' : IDL.Func(
        [IDL.Record({})],
        [MigrateLegacyPrincipalResponse],
        [],
      ),
    'prepare_delegation' : IDL.Func(
        [PrepareDelegationArgs],
        [PrepareDelegationResponse],
        [],
      ),
    'set_principal_migration_job_enabled' : IDL.Func(
        [SetPrincipalMigrationJobEnabledArgs],
        [SetPrincipalMigrationJobEnabledResponse],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
