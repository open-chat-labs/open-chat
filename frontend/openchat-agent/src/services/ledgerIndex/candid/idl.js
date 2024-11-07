export const idlFactory = ({ IDL }) => {
  const Value = IDL.Rec();
  const UpgradeArg = IDL.Record({
    'ledger_id' : IDL.Opt(IDL.Principal),
    'retrieve_blocks_from_ledger_interval_seconds' : IDL.Opt(IDL.Nat64),
  });
  const InitArg = IDL.Record({
    'ledger_id' : IDL.Principal,
    'retrieve_blocks_from_ledger_interval_seconds' : IDL.Opt(IDL.Nat64),
  });
  const IndexArg = IDL.Variant({ 'Upgrade' : UpgradeArg, 'Init' : InitArg });
  const BlockIndex = IDL.Nat;
  const SubAccount = IDL.Vec(IDL.Nat8);
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(SubAccount),
  });
  const GetAccountTransactionsArgs = IDL.Record({
    'max_results' : IDL.Nat,
    'start' : IDL.Opt(BlockIndex),
    'account' : Account,
  });
  const Tokens = IDL.Nat;
  const Burn = IDL.Record({
    'from' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
    'spender' : IDL.Opt(Account),
  });
  const Mint = IDL.Record({
    'to' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
  });
  const Approve = IDL.Record({
    'fee' : IDL.Opt(IDL.Nat),
    'from' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
    'expected_allowance' : IDL.Opt(IDL.Nat),
    'expires_at' : IDL.Opt(IDL.Nat64),
    'spender' : Account,
  });
  const Transfer = IDL.Record({
    'to' : Account,
    'fee' : IDL.Opt(IDL.Nat),
    'from' : Account,
    'memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'created_at_time' : IDL.Opt(IDL.Nat64),
    'amount' : IDL.Nat,
    'spender' : IDL.Opt(Account),
  });
  const Transaction = IDL.Record({
    'burn' : IDL.Opt(Burn),
    'kind' : IDL.Text,
    'mint' : IDL.Opt(Mint),
    'approve' : IDL.Opt(Approve),
    'timestamp' : IDL.Nat64,
    'transfer' : IDL.Opt(Transfer),
  });
  const TransactionWithId = IDL.Record({
    'id' : BlockIndex,
    'transaction' : Transaction,
  });
  const GetTransactions = IDL.Record({
    'balance' : Tokens,
    'transactions' : IDL.Vec(TransactionWithId),
    'oldest_tx_id' : IDL.Opt(BlockIndex),
  });
  const GetTransactionsErr = IDL.Record({ 'message' : IDL.Text });
  const GetTransactionsResult = IDL.Variant({
    'Ok' : GetTransactions,
    'Err' : GetTransactionsErr,
  });
  const GetBlocksRequest = IDL.Record({
    'start' : IDL.Nat,
    'length' : IDL.Nat,
  });
  const Map = IDL.Vec(IDL.Tuple(IDL.Text, Value));
  Value.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : Map,
      'Nat' : IDL.Nat,
      'Nat64' : IDL.Nat64,
      'Blob' : IDL.Vec(IDL.Nat8),
      'Text' : IDL.Text,
      'Array' : IDL.Vec(Value),
    })
  );
  const Block = Value;
  const GetBlocksResponse = IDL.Record({
    'blocks' : IDL.Vec(Block),
    'chain_length' : IDL.Nat64,
  });
  const FeeCollectorRanges = IDL.Record({
    'ranges' : IDL.Vec(
      IDL.Tuple(Account, IDL.Vec(IDL.Tuple(BlockIndex, BlockIndex)))
    ),
  });
  const ListSubaccountsArgs = IDL.Record({
    'owner' : IDL.Principal,
    'start' : IDL.Opt(SubAccount),
  });
  const Status = IDL.Record({ 'num_blocks_synced' : BlockIndex });
  return IDL.Service({
    'get_account_transactions' : IDL.Func(
        [GetAccountTransactionsArgs],
        [GetTransactionsResult],
        ['query'],
      ),
    'get_blocks' : IDL.Func([GetBlocksRequest], [GetBlocksResponse], ['query']),
    'get_fee_collectors_ranges' : IDL.Func([], [FeeCollectorRanges], ['query']),
    'icrc1_balance_of' : IDL.Func([Account], [Tokens], ['query']),
    'ledger_id' : IDL.Func([], [IDL.Principal], ['query']),
    'list_subaccounts' : IDL.Func(
        [ListSubaccountsArgs],
        [IDL.Vec(SubAccount)],
        ['query'],
      ),
    'status' : IDL.Func([], [Status], ['query']),
  });
};
export const init = ({ IDL }) => {
  const UpgradeArg = IDL.Record({
    'ledger_id' : IDL.Opt(IDL.Principal),
    'retrieve_blocks_from_ledger_interval_seconds' : IDL.Opt(IDL.Nat64),
  });
  const InitArg = IDL.Record({
    'ledger_id' : IDL.Principal,
    'retrieve_blocks_from_ledger_interval_seconds' : IDL.Opt(IDL.Nat64),
  });
  const IndexArg = IDL.Variant({ 'Upgrade' : UpgradeArg, 'Init' : InitArg });
  return [IDL.Opt(IndexArg)];
};
