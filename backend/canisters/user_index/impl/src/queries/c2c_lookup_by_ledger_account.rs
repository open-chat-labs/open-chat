use crate::guards::caller_is_user_canister;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::c2c_lookup_by_ledger_account::{Response::*, *};

#[query(guard = "caller_is_user_canister")]
fn c2c_lookup_by_ledger_account(args: Args) -> Response {
    read_state(|state| c2c_lookup_by_ledger_account_impl(args, state))
}

fn c2c_lookup_by_ledger_account_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    runtime_state
        .data
        .users
        .get_by_ledger_account(&args.account_identifier)
        .map(|u| u.user_id)
        .map_or(UserNotFound, Success)
}
