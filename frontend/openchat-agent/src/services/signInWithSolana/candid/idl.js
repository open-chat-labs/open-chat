export const idlFactory = ({ IDL }) => {
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
  const SiwsSignature = IDL.Text;
  const CanisterPublicKey = PublicKey;
  const LoginDetails = IDL.Record({
    'user_canister_pubkey' : CanisterPublicKey,
    'expiration' : Timestamp,
  });
  const LoginResponse = IDL.Variant({ 'Ok' : LoginDetails, 'Err' : IDL.Text });
  const SiwsMessage = IDL.Record({
    'uri' : IDL.Text,
    'issued_at' : IDL.Nat64,
    'domain' : IDL.Text,
    'statement' : IDL.Text,
    'version' : IDL.Nat32,
    'chain_id' : IDL.Text,
    'address' : Address,
    'nonce' : IDL.Text,
    'expiration_time' : IDL.Nat64,
  });
  const PrepareLoginResponse = IDL.Variant({
    'Ok' : SiwsMessage,
    'Err' : IDL.Text,
  });
  return IDL.Service({
    'get_address' : IDL.Func([Principal], [GetAddressResponse], ['query']),
    'get_caller_address' : IDL.Func([], [GetAddressResponse], ['query']),
    'get_principal' : IDL.Func([Address], [GetPrincipalResponse], ['query']),
    'siws_get_delegation' : IDL.Func(
        [Address, SessionKey, Timestamp],
        [GetDelegationResponse],
        ['query'],
      ),
    'siws_login' : IDL.Func(
        [SiwsSignature, Address, SessionKey],
        [LoginResponse],
        [],
      ),
    'siws_prepare_login' : IDL.Func([Address], [PrepareLoginResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
