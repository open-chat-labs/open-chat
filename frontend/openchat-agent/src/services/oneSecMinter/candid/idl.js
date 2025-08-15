export const idlFactory = ({ IDL }) => {
  const Token = IDL.Variant({
    'BOB' : IDL.Null,
    'ICP' : IDL.Null,
    'GLDT' : IDL.Null,
    'USDC' : IDL.Null,
    'USDT' : IDL.Null,
    'cbBTC' : IDL.Null,
    'ckBTC' : IDL.Null,
  });
  const EvmChain = IDL.Variant({
    'Base' : IDL.Null,
    'Ethereum' : IDL.Null,
    'Arbitrum' : IDL.Null,
  });
  const IcpAccount = IDL.Variant({
    'ICRC' : IDL.Record({
      'owner' : IDL.Principal,
      'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    }),
    'AccountId' : IDL.Text,
  });
  const ForwardEvmToIcpArg = IDL.Record({
    'token' : Token,
    'chain' : EvmChain,
    'address' : IDL.Text,
    'receiver' : IcpAccount,
  });
  const EvmTx = IDL.Record({
    'log_index' : IDL.Opt(IDL.Nat64),
    'hash' : IDL.Text,
  });
  const ForwardingStatus = IDL.Variant({
    'LowBalance' : IDL.Record({ 'balance' : IDL.Nat, 'min_amount' : IDL.Nat }),
    'CheckingBalance' : IDL.Null,
    'Forwarding' : IDL.Null,
    'Forwarded' : EvmTx,
  });
  const TransferId = IDL.Record({ 'id' : IDL.Nat64 });
  const ForwardingResponse = IDL.Record({
    'status' : IDL.Opt(ForwardingStatus),
    'done' : IDL.Opt(TransferId),
  });
  const ErrorMessage = IDL.Record({ 'error' : IDL.Text });
  const IcpTx = IDL.Record({
    'block_index' : IDL.Nat64,
    'ledger' : IDL.Principal,
  });
  const Tx = IDL.Variant({ 'Evm' : EvmTx, 'Icp' : IcpTx });
  const Status = IDL.Variant({
    'Failed' : ErrorMessage,
    'Refunded' : Tx,
    'PendingRefundTx' : IDL.Null,
    'PendingDestinationTx' : IDL.Null,
    'Succeeded' : IDL.Null,
    'PendingSourceTx' : IDL.Null,
  });
  const Chain = IDL.Variant({
    'ICP' : IDL.Null,
    'Base' : IDL.Null,
    'Ethereum' : IDL.Null,
    'Arbitrum' : IDL.Null,
  });
  const EvmAccount = IDL.Record({ 'address' : IDL.Text });
  const Account = IDL.Variant({ 'Evm' : EvmAccount, 'Icp' : IcpAccount });
  const AssetInfo = IDL.Record({
    'tx' : IDL.Opt(Tx),
    'token' : IDL.Opt(Token),
    'chain' : IDL.Opt(Chain),
    'account' : IDL.Opt(Account),
    'amount' : IDL.Nat,
  });
  const Result = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const TraceEvent = IDL.Variant({
    'PendingConfirmTx' : IDL.Null,
    'ConfirmTx' : IDL.Null,
    'SendTx' : IDL.Null,
    'FetchTx' : IDL.Null,
    'SignTx' : IDL.Null,
  });
  const TraceEntry = IDL.Record({
    'tx' : IDL.Opt(Tx),
    'end' : IDL.Opt(IDL.Nat64),
    'result' : IDL.Opt(Result),
    'chain' : IDL.Opt(Chain),
    'block_number' : IDL.Opt(IDL.Nat64),
    'event' : IDL.Opt(TraceEvent),
    'start' : IDL.Nat64,
  });
  const Trace = IDL.Record({ 'entries' : IDL.Vec(TraceEntry) });
  const Transfer = IDL.Record({
    'end' : IDL.Opt(IDL.Nat64),
    'status' : IDL.Opt(Status),
    'destination' : AssetInfo,
    'trace' : Trace,
    'source' : AssetInfo,
    'start' : IDL.Opt(IDL.Nat64),
    'queue_position' : IDL.Opt(IDL.Nat64),
  });
  const TransferFee = IDL.Record({
    'source_chain' : IDL.Opt(Chain),
    'destination_chain' : IDL.Opt(Chain),
    'latest_transfer_fee_in_tokens' : IDL.Nat,
    'min_amount' : IDL.Nat,
    'average_transfer_fee_in_tokens' : IDL.Nat,
    'available' : IDL.Opt(IDL.Nat),
    'source_token' : IDL.Opt(Token),
    'max_amount' : IDL.Nat,
    'protocol_fee_in_percent' : IDL.Float64,
    'destination_token' : IDL.Opt(Token),
  });
  return IDL.Service({
    'forward_evm_to_icp' : IDL.Func(
        [ForwardEvmToIcpArg],
        [IDL.Variant({ 'Ok' : ForwardingResponse, 'Err' : IDL.Text })],
        [],
      ),
    'get_forwarding_address' : IDL.Func(
        [IcpAccount],
        [IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text })],
        ['query'],
      ),
    'get_forwarding_status' : IDL.Func(
        [ForwardEvmToIcpArg],
        [IDL.Variant({ 'Ok' : ForwardingResponse, 'Err' : IDL.Text })],
        ['query'],
      ),
    'get_transfer' : IDL.Func(
        [TransferId],
        [IDL.Variant({ 'Ok' : Transfer, 'Err' : IDL.Text })],
        ['query'],
      ),
    'get_transfer_fees' : IDL.Func([], [IDL.Vec(TransferFee)], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
