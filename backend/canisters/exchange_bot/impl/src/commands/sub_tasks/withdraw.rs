use crate::commands::CommandSubTaskResult;
use crate::model::messages_pending::MessagePending;
use crate::mutate_state;
use candid::{Nat, Principal};
use ic_cdk::api::call::CallResult;
use ic_ledger_types::{AccountIdentifier, Memo, Timestamp, Tokens, TransferArgs, DEFAULT_SUBACCOUNT};
use ledger_utils::{calculate_transaction_hash, convert_to_subaccount, default_ledger_account};
use rand::Rng;
use types::icrc1::{Account, BlockIndex, CryptoAccount, TransferArg, TransferError};
use types::{
    icrc1, nns, CompletedCryptoTransaction, CryptoContent, CryptoTransaction, Cryptocurrency, MessageContentInitial,
    TimestampNanos, TokenInfo, UserId,
};

pub async fn withdraw(
    user_id: UserId,
    token: &TokenInfo,
    amount: u128,
    default_subaccount: bool,
    now_nanos: TimestampNanos,
) -> CommandSubTaskResult<BlockIndex> {
    match transfer_to_user(user_id, token, amount, default_subaccount, now_nanos).await {
        Ok(Ok(block_index)) => CommandSubTaskResult::Complete(block_index, None),
        Ok(Err(error)) => CommandSubTaskResult::Failed(format!("{error:?}")),
        Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
    }
}

async fn transfer_to_user(
    user_id: UserId,
    token: &TokenInfo,
    amount: u128,
    default_subaccount: bool,
    now_nanos: TimestampNanos,
) -> CallResult<Result<Nat, TransferError>> {
    let subaccount = if default_subaccount { DEFAULT_SUBACCOUNT } else { convert_to_subaccount(&user_id.into()) };
    let response = icrc1_ledger_canister_c2c_client::icrc1_transfer(
        token.ledger,
        &TransferArg {
            from_subaccount: Some(subaccount.0),
            to: Account::from(Principal::from(user_id)),
            fee: Some(token.fee.into()),
            created_at_time: Some(now_nanos),
            memo: None,
            amount: amount.into(),
        },
    )
    .await;

    if let Ok(Ok(block_index)) = &response {
        mutate_state(|state| {
            let this_canister_id = state.env.canister_id();
            let transaction = if matches!(token.token, Cryptocurrency::InternetComputer) {
                let transfer_args = TransferArgs {
                    memo: Memo(0),
                    amount: Tokens::from_e8s(amount.try_into().unwrap()),
                    fee: Tokens::from_e8s(Cryptocurrency::InternetComputer.fee().unwrap().try_into().unwrap()),
                    from_subaccount: Some(subaccount),
                    to: default_ledger_account(user_id.into()),
                    created_at_time: Some(Timestamp {
                        timestamp_nanos: now_nanos,
                    }),
                };
                let transaction_hash = calculate_transaction_hash(this_canister_id, &transfer_args);
                CompletedCryptoTransaction::NNS(nns::CompletedCryptoTransaction {
                    ledger: token.ledger,
                    token: token.token.clone(),
                    amount: Tokens::from_e8s(amount.try_into().unwrap()),
                    fee: Tokens::from_e8s(token.fee.try_into().unwrap()),
                    from: nns::CryptoAccount::Account(AccountIdentifier::new(&this_canister_id, &subaccount)),
                    to: nns::CryptoAccount::Account(default_ledger_account(user_id.into())),
                    memo: Memo(0),
                    created: now_nanos,
                    transaction_hash,
                    block_index: block_index.0.clone().try_into().unwrap(),
                })
            } else {
                CompletedCryptoTransaction::ICRC1(icrc1::CompletedCryptoTransaction {
                    ledger: token.ledger,
                    token: token.token.clone(),
                    amount,
                    from: CryptoAccount::Account(Account {
                        owner: this_canister_id,
                        subaccount: Some(subaccount.0),
                    }),
                    to: CryptoAccount::Account(Account::from(Principal::from(user_id))),
                    fee: token.fee,
                    memo: None,
                    created: now_nanos,
                    block_index: block_index.0.clone().try_into().unwrap(),
                })
            };
            let message_id = state.env.rng().gen();
            state.enqueue_message(
                user_id,
                message_id,
                MessagePending::Send(MessageContentInitial::Crypto(CryptoContent {
                    recipient: user_id,
                    transfer: CryptoTransaction::Completed(transaction),
                    caption: None,
                })),
                false,
            );
        });
    }

    response
}
