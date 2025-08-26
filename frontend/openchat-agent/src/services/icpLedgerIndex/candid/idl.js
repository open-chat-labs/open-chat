export const idlFactory = ({ IDL }) => {
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const GetAccountTransactionsArgs = IDL.Record({
    'max_results' : IDL.Nat,
    'start' : IDL.Opt(IDL.Nat),
    'account' : Account,
  });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const TimeStamp = IDL.Record({ 'timestamp_nanos' : IDL.Nat64 });
  const Operation = IDL.Variant({
    'Approve' : IDL.Record({
      'fee' : Tokens,
      'from' : IDL.Text,
      'allowance' : Tokens,
      'expected_allowance' : IDL.Opt(Tokens),
      'expires_at' : IDL.Opt(TimeStamp),
      'spender' : IDL.Text,
    }),
    'Burn' : IDL.Record({
      'from' : IDL.Text,
      'amount' : Tokens,
      'spender' : IDL.Opt(IDL.Text),
    }),
    'Mint' : IDL.Record({ 'to' : IDL.Text, 'amount' : Tokens }),
    'Transfer' : IDL.Record({
      'to' : IDL.Text,
      'fee' : Tokens,
      'from' : IDL.Text,
      'amount' : Tokens,
      'spender' : IDL.Opt(IDL.Text),
    }),
  });
  const Transaction = IDL.Record({
    'memo' : IDL.Nat64,
    'icrc1_memo' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'operation' : Operation,
    'timestamp' : IDL.Opt(TimeStamp),
    'created_at_time' : IDL.Opt(TimeStamp),
  });
  const TransactionWithId = IDL.Record({
    'id' : IDL.Nat64,
    'transaction' : Transaction,
  });
  const GetAccountIdentifierTransactionsResponse = IDL.Record({
    'balance' : IDL.Nat64,
    'transactions' : IDL.Vec(TransactionWithId),
    'oldest_tx_id' : IDL.Opt(IDL.Nat64),
  });
  const GetAccountIdentifierTransactionsError = IDL.Record({
    'message' : IDL.Text,
  });
  const GetAccountIdentifierTransactionsResult = IDL.Variant({
    'Ok' : GetAccountIdentifierTransactionsResponse,
    'Err' : GetAccountIdentifierTransactionsError,
  });
  return IDL.Service({
    'get_account_transactions' : IDL.Func(
        [GetAccountTransactionsArgs],
        [GetAccountIdentifierTransactionsResult],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
