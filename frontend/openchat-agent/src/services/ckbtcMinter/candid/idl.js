export const idlFactory = ({ IDL }) => {
  const Utxo = IDL.Record({
    'height' : IDL.Nat32,
    'value' : IDL.Nat64,
    'outpoint' : IDL.Record({ 'txid' : IDL.Vec(IDL.Nat8), 'vout' : IDL.Nat32 }),
  });
  const MinterInfo = IDL.Record({
    'retrieve_btc_min_amount' : IDL.Nat64,
    'min_confirmations' : IDL.Nat32,
    'kyt_fee' : IDL.Nat64,
  });
  return IDL.Service({
    'estimate_withdrawal_fee' : IDL.Func(
        [IDL.Record({ 'amount' : IDL.Opt(IDL.Nat64) })],
        [IDL.Record({ 'minter_fee' : IDL.Nat64, 'bitcoin_fee' : IDL.Nat64 })],
        ['query'],
      ),
    'get_deposit_fee' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_known_utxos' : IDL.Func(
        [
          IDL.Record({
            'owner' : IDL.Opt(IDL.Principal),
            'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
          }),
        ],
        [IDL.Vec(Utxo)],
        ['query'],
      ),
    'get_minter_info' : IDL.Func([], [MinterInfo], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
