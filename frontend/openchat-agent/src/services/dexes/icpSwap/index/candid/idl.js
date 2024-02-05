export const idlFactory = ({ IDL }) => {
  const Token = IDL.Record({ 'address' : IDL.Text, 'standard' : IDL.Text });
  const PoolData = IDL.Record({
    'token0' : Token,
    'token1' : Token,
    'canisterId' : IDL.Principal,
  });
  const Error = IDL.Variant({
    'CommonError' : IDL.Null,
    'InternalError' : IDL.Text,
    'UnsupportedToken' : IDL.Text,
    'InsufficientFunds' : IDL.Null,
  });
  const GetPoolsResponse = IDL.Variant({
    'ok' : IDL.Vec(PoolData),
    'err' : Error,
  });
  return IDL.Service({
    'getPools' : IDL.Func([], [GetPoolsResponse], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
