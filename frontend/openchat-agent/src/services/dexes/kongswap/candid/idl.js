export const idlFactory = ({ IDL }) => {
  const SwapAmountsReply = IDL.Record({ 'receive_amount' : IDL.Nat });
  const SwapAmountsResult = IDL.Variant({
    'Ok' : SwapAmountsReply,
    'Err' : IDL.Text,
  });
  const ICTokenReply = IDL.Record({
    'canister_id' : IDL.Text,
    'is_removed' : IDL.Bool,
  });
  const LPTokenReply = IDL.Record({});
  const TokenReply = IDL.Variant({ 'IC' : ICTokenReply, 'LP' : LPTokenReply });
  const TokensResult = IDL.Variant({
    'Ok' : IDL.Vec(TokenReply),
    'Err' : IDL.Text,
  });
  return IDL.Service({
    'swap_amounts' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Text],
        [SwapAmountsResult],
        ['query'],
      ),
    'tokens' : IDL.Func([IDL.Opt(IDL.Text)], [TokensResult], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
