use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::configure_wallet::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn configure_wallet(args: Args) -> Response {
    execute_update(|state| configure_wallet_impl(args, state))
}

fn configure_wallet_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.data.user.set_wallet_config(args.config, now);
    Response::Success
}
