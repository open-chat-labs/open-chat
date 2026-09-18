use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::configure_wallet::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn configure_wallet(args: Args) -> Response {
    mutate_state(|state| configure_wallet_impl(args, state))
}

fn configure_wallet_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| user.wallet_config = Timestamped::new(args.config, now));
    Response::Success
}
