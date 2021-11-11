use crate::guards::caller_is_owner;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_canister::transactions::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn transactions(args: Args) -> Response {
    RUNTIME_STATE.with(|state| transactions_impl(args, state.borrow().as_ref().unwrap()))
}

fn transactions_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let transactions =
        runtime_state
            .data
            .transactions
            .from_index(args.start_index as usize, args.ascending, args.max_transactions);

    let latest_transaction_index = runtime_state.data.transactions.latest_index();

    Success(SuccessResult {
        transactions,
        latest_transaction_index,
    })
}
