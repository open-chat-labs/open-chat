export const idlFactory = ({ IDL }) => {
  const network = IDL.Variant({
    'mainnet' : IDL.Null,
    'regtest' : IDL.Null,
    'testnet' : IDL.Null,
  });
  const address = IDL.Text;
  const get_utxos_request = IDL.Record({
    'network' : network,
    'filter' : IDL.Opt(
      IDL.Variant({
        'page' : IDL.Vec(IDL.Nat8),
        'min_confirmations' : IDL.Nat32,
      })
    ),
    'address' : address,
  });
  const block_height = IDL.Nat32;
  const block_hash = IDL.Vec(IDL.Nat8);
  const satoshi = IDL.Nat64;
  const outpoint = IDL.Record({
    'txid' : IDL.Vec(IDL.Nat8),
    'vout' : IDL.Nat32,
  });
  const utxo = IDL.Record({
    'height' : block_height,
    'value' : satoshi,
    'outpoint' : outpoint,
  });
  const get_utxos_response = IDL.Record({
    'next_page' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'tip_height' : block_height,
    'tip_block_hash' : block_hash,
    'utxos' : IDL.Vec(utxo),
  });
  return IDL.Service({
    'bitcoin_get_utxos_query' : IDL.Func(
        [get_utxos_request],
        [get_utxos_response],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
