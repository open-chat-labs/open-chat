export const idlFactory = ({ IDL }) => {
  const Utxo = IDL.Record({
    'height' : IDL.Nat32,
    'value' : IDL.Nat64,
    'outpoint' : IDL.Record({ 'txid' : IDL.Vec(IDL.Nat8), 'vout' : IDL.Nat32 }),
  });
  const UtxoStatus = IDL.Variant({
    'ValueTooSmall' : Utxo,
    'Tainted' : Utxo,
    'Minted' : IDL.Record({
      'minted_amount' : IDL.Nat64,
      'block_index' : IDL.Nat64,
      'utxo' : Utxo,
    }),
    'Checked' : Utxo,
  });
  const PendingUtxo = IDL.Record({
    'confirmations' : IDL.Nat32,
    'value' : IDL.Nat64,
    'outpoint' : IDL.Record({ 'txid' : IDL.Vec(IDL.Nat8), 'vout' : IDL.Nat32 }),
  });
  const UpdateBalanceError = IDL.Variant({
    'GenericError' : IDL.Record({
      'error_message' : IDL.Text,
      'error_code' : IDL.Nat64,
    }),
    'TemporarilyUnavailable' : IDL.Text,
    'AlreadyProcessing' : IDL.Null,
    'NoNewUtxos' : IDL.Record({
      'required_confirmations' : IDL.Nat32,
      'pending_utxos' : IDL.Opt(IDL.Vec(PendingUtxo)),
      'current_confirmations' : IDL.Opt(IDL.Nat32),
    }),
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
    'update_balance' : IDL.Func(
        [
          IDL.Record({
            'owner' : IDL.Opt(IDL.Principal),
            'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
          }),
        ],
        [
          IDL.Variant({
            'Ok' : IDL.Vec(UtxoStatus),
            'Err' : UpdateBalanceError,
          }),
        ],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
