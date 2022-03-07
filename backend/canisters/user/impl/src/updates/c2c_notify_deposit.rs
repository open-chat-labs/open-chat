use crate::guards::caller_is_ledger_sync_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_canister::c2c_notify_deposit::{Response::*, *};

#[update(guard = "caller_is_ledger_sync_canister")]
#[trace]
fn c2c_notify_deposit(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_deposit_impl(args, state))
}

fn c2c_notify_deposit_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    runtime_state.data.transactions.add(args.deposit, now);
    Success
}
