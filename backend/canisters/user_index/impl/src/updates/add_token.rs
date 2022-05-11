use crate::guards::caller_is_controller;
use crate::read_state;
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::add_token::{Response::*, *};

#[update(guard = "caller_is_controller")]
#[trace]
async fn add_token(args: Args) -> Response {
    let transaction_notifier_canister_id = read_state(|state| state.data.transaction_notifier_canister_id);

    match transaction_notifier_c2c_client::add_token(transaction_notifier_canister_id, &args).await {
        Ok(transaction_notifier::add_token::Response::Success) => Success,
        Ok(transaction_notifier::add_token::Response::AlreadyAdded) => AlreadyAdded,
        Ok(transaction_notifier::add_token::Response::LedgerError(error)) => LedgerError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
