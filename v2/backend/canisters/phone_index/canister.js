export default ({ IDL }) => {
  const PhoneNumber = IDL.Record({
    'country_code' : IDL.Nat16,
    'number' : IDL.Nat64,
  });
  const ClaimRequest = IDL.Record({
    'code' : IDL.Nat32,
    'number' : PhoneNumber,
  });
  const CanisterId = IDL.Principal;
  const ClaimResponse = IDL.Variant({
    'Invalid' : IDL.Null,
    'Success' : IDL.Record({ 'canister' : CanisterId }),
    'Expired' : IDL.Null,
  });
  const RegisterRequest = IDL.Record({ 'number' : PhoneNumber });
  const RegisterResponse = IDL.Variant({
    'Success' : IDL.Null,
    'Taken' : IDL.Null,
    'TooManyAttempts' : IDL.Null,
  });
  return IDL.Service({
    'claim' : IDL.Func([ClaimRequest], [ClaimResponse], []),
    'register' : IDL.Func([RegisterRequest], [RegisterResponse], []),
  });
};
export const init = ({ IDL }) => { return []; };
