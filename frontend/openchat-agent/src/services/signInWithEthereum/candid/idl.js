export const idlFactory = ({ IDL }) => {
  const RuntimeFeature = IDL.Variant({
    'IncludeUriInSeed' : IDL.Null,
    'DisableEthToPrincipalMapping' : IDL.Null,
    'DisablePrincipalToEthMapping' : IDL.Null,
  });
  const SettingsInput = IDL.Record({
    'uri' : IDL.Text,
    'runtime_features' : IDL.Opt(IDL.Vec(RuntimeFeature)),
    'domain' : IDL.Text,
    'statement' : IDL.Opt(IDL.Text),
    'scheme' : IDL.Opt(IDL.Text),
    'salt' : IDL.Text,
    'session_expires_in' : IDL.Opt(IDL.Nat64),
    'targets' : IDL.Opt(IDL.Vec(IDL.Text)),
    'chain_id' : IDL.Opt(IDL.Nat),
    'sign_in_expires_in' : IDL.Opt(IDL.Nat64),
  });
  const Principal = IDL.Vec(IDL.Nat8);
  const Address = IDL.Text;
  const GetAddressResponse = IDL.Variant({ 'Ok' : Address, 'Err' : IDL.Text });
  const GetPrincipalResponse = IDL.Variant({
    'Ok' : Principal,
    'Err' : IDL.Text,
  });
  const PublicKey = IDL.Vec(IDL.Nat8);
  const SessionKey = PublicKey;
  const Timestamp = IDL.Nat64;
  const Delegation = IDL.Record({
    'pubkey' : PublicKey,
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'expiration' : Timestamp,
  });
  const SignedDelegation = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'delegation' : Delegation,
  });
  const GetDelegationResponse = IDL.Variant({
    'Ok' : SignedDelegation,
    'Err' : IDL.Text,
  });
  const SiweSignature = IDL.Text;
  const Nonce = IDL.Text;
  const CanisterPublicKey = PublicKey;
  const LoginDetails = IDL.Record({
    'user_canister_pubkey' : CanisterPublicKey,
    'expiration' : Timestamp,
  });
  const LoginResponse = IDL.Variant({ 'Ok' : LoginDetails, 'Err' : IDL.Text });
  const SiweMessage = IDL.Text;
  const PrepareLoginOkResponse = IDL.Record({
    'nonce' : IDL.Text,
    'siwe_message' : SiweMessage,
  });
  const PrepareLoginResponse = IDL.Variant({
    'Ok' : PrepareLoginOkResponse,
    'Err' : IDL.Text,
  });
  return IDL.Service({
    'get_address' : IDL.Func([Principal], [GetAddressResponse], ['query']),
    'get_caller_address' : IDL.Func([], [GetAddressResponse], ['query']),
    'get_principal' : IDL.Func([Address], [GetPrincipalResponse], ['query']),
    'siwe_get_delegation' : IDL.Func(
        [Address, SessionKey, Timestamp],
        [GetDelegationResponse],
        ['query'],
      ),
    'siwe_login' : IDL.Func(
        [SiweSignature, Address, SessionKey, Nonce],
        [LoginResponse],
        [],
      ),
    'siwe_prepare_login' : IDL.Func([Address], [PrepareLoginResponse], []),
  });
};
export const init = ({ IDL }) => {
  const RuntimeFeature = IDL.Variant({
    'IncludeUriInSeed' : IDL.Null,
    'DisableEthToPrincipalMapping' : IDL.Null,
    'DisablePrincipalToEthMapping' : IDL.Null,
  });
  const SettingsInput = IDL.Record({
    'uri' : IDL.Text,
    'runtime_features' : IDL.Opt(IDL.Vec(RuntimeFeature)),
    'domain' : IDL.Text,
    'statement' : IDL.Opt(IDL.Text),
    'scheme' : IDL.Opt(IDL.Text),
    'salt' : IDL.Text,
    'session_expires_in' : IDL.Opt(IDL.Nat64),
    'targets' : IDL.Opt(IDL.Vec(IDL.Text)),
    'chain_id' : IDL.Opt(IDL.Nat),
    'sign_in_expires_in' : IDL.Opt(IDL.Nat64),
  });
  return [SettingsInput];
};
