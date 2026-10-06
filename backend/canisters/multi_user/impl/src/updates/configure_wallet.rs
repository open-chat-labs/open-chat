use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::configure_wallet::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn configure_wallet(args: Args) -> Response {
    execute_update(|state| configure_wallet_impl(args, state))
}

fn configure_wallet_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| user.set_wallet_config(args.config, now));
    Response::Success
}
