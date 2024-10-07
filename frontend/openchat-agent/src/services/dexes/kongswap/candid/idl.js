export const idlFactory = ({ IDL }) => {
  const SwapAmountsTxReply = IDL.Record({
    'receive_chain' : IDL.Text,
    'pay_amount' : IDL.Nat,
    'receive_amount' : IDL.Nat,
    'pay_symbol' : IDL.Text,
    'receive_symbol' : IDL.Text,
    'pool_symbol' : IDL.Text,
    'price' : IDL.Float64,
    'pay_chain' : IDL.Text,
    'lp_fee' : IDL.Nat,
    'gas_fee' : IDL.Nat,
  });
  const SwapAmountsReply = IDL.Record({
    'txs' : IDL.Vec(SwapAmountsTxReply),
    'receive_chain' : IDL.Text,
    'mid_price' : IDL.Float64,
    'pay_amount' : IDL.Nat,
    'receive_amount' : IDL.Nat,
    'pay_symbol' : IDL.Text,
    'receive_symbol' : IDL.Text,
    'price' : IDL.Float64,
    'pay_chain' : IDL.Text,
    'slippage' : IDL.Float64,
  });
  const SwapAmountsResult = IDL.Variant({
    'Ok' : SwapAmountsReply,
    'Err' : IDL.Text,
  });
  const ICTokenReply = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'token' : IDL.Text,
    'token_id' : IDL.Nat32,
    'chain' : IDL.Text,
    'name' : IDL.Text,
    'canister_id' : IDL.Text,
    'icrc1' : IDL.Bool,
    'icrc2' : IDL.Bool,
    'icrc3' : IDL.Bool,
    'pool_symbol' : IDL.Text,
    'symbol' : IDL.Text,
    'on_kong' : IDL.Bool,
  });
  const LPTokenReply = IDL.Record({
    'fee' : IDL.Nat,
    'decimals' : IDL.Nat8,
    'token' : IDL.Text,
    'token_id' : IDL.Nat32,
    'chain' : IDL.Text,
    'name' : IDL.Text,
    'address' : IDL.Text,
    'pool_id_of' : IDL.Nat32,
    'pool_symbol' : IDL.Text,
    'total_supply' : IDL.Nat,
    'symbol' : IDL.Text,
    'on_kong' : IDL.Bool,
  });
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
