use crate::guards::caller_is_transaction_notifier_canister;
use crate::model::address_book::AccountOwner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountIdentifier, Block, BlockIndex, Operation, Tokens};
use std::str::FromStr;
use types::Cryptocurrency;
use types::{
    AlertDetails, CanisterId, CompletedCryptocurrencyDeposit, CompletedCryptocurrencyTransfer,
    CompletedCryptocurrencyWithdrawal, CryptocurrencyDeposit, CryptocurrencyTransaction, CryptocurrencyTransfer,
    CryptocurrencyWithdrawal, UserId,
};
use user_canister::notify_transaction::*;

#[update(guard = "caller_is_transaction_notifier_canister")]
#[trace]
async fn notify_transaction(args: Args) -> Response {
    run_regular_jobs();

    if let Ok(token) = Cryptocurrency::from_str(args.token_symbol.trim()) {
        if let Operation::Transfer { from, to, amount, fee } = args.block.transaction.operation {
            process_transfer(token, from, to, amount, fee, args.block_index, args.block).await
        }
    }
}

async fn process_transfer(
    token: Cryptocurrency,
    from: AccountIdentifier,
    to: AccountIdentifier,
    amount: Tokens,
    fee: Tokens,
    block_index: BlockIndex,
    block: Block,
) -> Response {
    let accounts = read_state(|state| lookup_accounts_in_address_book(from, to, state));

    let (sent_by_me, other) = match (accounts.from, accounts.to) {
        (KnownOrUnknown::Known(AccountOwner::Me), other) => (true, other),
        (other, KnownOrUnknown::Known(AccountOwner::Me)) => (false, other),
        _ => return,
    };

    let other = match other {
        KnownOrUnknown::Known(account) => account,
        KnownOrUnknown::Unknown(account_identifier) => {
            let c2c_args = user_index_canister::c2c_lookup_by_ledger_account::Args { account_identifier };
            match user_index_canister_c2c_client::c2c_lookup_by_ledger_account(accounts.user_index_canister_id, &c2c_args).await
            {
                Ok(res) => {
                    let account = match res {
                        user_index_canister::c2c_lookup_by_ledger_account::Response::Success(user_id) => {
                            AccountOwner::User(user_id)
                        }
                        user_index_canister::c2c_lookup_by_ledger_account::Response::UserNotFound => {
                            AccountOwner::External(None)
                        }
                    };
                    mutate_state(|state| state.data.address_book.add(account_identifier, account.clone()));
                    account
                }
                Err(_) => {
                    // TODO handle this!
                    return;
                }
            }
        }
    };

    let memo = block.transaction.memo;
    let transaction_hash = block.transaction.hash();

    let transaction = match other {
        AccountOwner::User(user_id) => {
            CryptocurrencyTransaction::Transfer(CryptocurrencyTransfer::Completed(CompletedCryptocurrencyTransfer {
                token,
                sender: if sent_by_me { accounts.my_user_id } else { user_id },
                recipient: if sent_by_me { user_id } else { accounts.my_user_id },
                amount,
                fee,
                memo,
                block_index,
                transaction_hash,
            }))
        }
        AccountOwner::External(_) if sent_by_me => {
            CryptocurrencyTransaction::Withdrawal(CryptocurrencyWithdrawal::Completed(CompletedCryptocurrencyWithdrawal {
                token,
                to,
                amount,
                fee,
                memo,
                block_index,
                transaction_hash,
            }))
        }
        AccountOwner::External(_) if !sent_by_me => {
            CryptocurrencyTransaction::Deposit(CryptocurrencyDeposit::Completed(CompletedCryptocurrencyDeposit {
                token,
                from,
                amount,
                fee,
                memo,
                block_index,
                transaction_hash,
            }))
        }
        _ => return,
    };

    mutate_state(|state| {
        if let CryptocurrencyTransaction::Deposit(d) = &transaction {
            let now = state.env.now();
            state
                .data
                .alerts
                .add(AlertDetails::CryptocurrencyDepositReceived(d.clone()), now);
        }
        state.data.crypto_transactions.add(block_index, transaction, block);
    });
}

#[derive(Debug)]
enum KnownOrUnknown {
    Known(AccountOwner),
    Unknown(AccountIdentifier),
}

#[derive(Debug)]
struct LookupAccountsResult {
    my_user_id: UserId,
    from: KnownOrUnknown,
    to: KnownOrUnknown,
    user_index_canister_id: CanisterId,
}

fn lookup_accounts_in_address_book(
    from: AccountIdentifier,
    to: AccountIdentifier,
    runtime_state: &RuntimeState,
) -> LookupAccountsResult {
    LookupAccountsResult {
        my_user_id: runtime_state.env.canister_id().into(),
        from: runtime_state
            .data
            .address_book
            .get(&from)
            .map_or(KnownOrUnknown::Unknown(from), KnownOrUnknown::Known),
        to: runtime_state
            .data
            .address_book
            .get(&to)
            .map_or(KnownOrUnknown::Unknown(to), KnownOrUnknown::Known),
        user_index_canister_id: runtime_state.data.user_index_canister_id,
    }
}
