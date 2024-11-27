use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::configure_wallet::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn configure_wallet(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| configure_wallet_impl(args, state))
}

fn configure_wallet_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.wallet_config = Timestamped::new(args.config, state.env.now());
    Success
}
