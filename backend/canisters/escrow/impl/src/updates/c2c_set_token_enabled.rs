use crate::guards::caller_is_registry_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::c2c_set_token_enabled::{Response::*, *};

#[update(guard = "caller_is_registry_canister", msgpack = true)]
#[trace]
fn c2c_set_token_enabled(args: Args) -> Response {
    mutate_state(|state| c2c_set_token_enabled_impl(args, state))
}

fn c2c_set_token_enabled_impl(args: Args, state: &mut RuntimeState) -> Response {
    if args.enabled {
        state.data.disabled_tokens.remove(&args.ledger_canister_id);
    } else {
        state.data.disabled_tokens.insert(args.ledger_canister_id);
    }
    Success
}
