use crate::guards::caller_is_push_service;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::remove_apns_tokens::*;

/// Removes the tokens APNs rejected as no longer valid. Each token goes on its own, so a device
/// keeps its other token.
#[update(guard = "caller_is_push_service", msgpack = true)]
#[trace]
fn remove_apns_tokens(args: Args) -> Response {
    mutate_state(|state| remove_apns_tokens_impl(args, state))
}

fn remove_apns_tokens_impl(args: Args, state: &mut RuntimeState) -> Response {
    for user in args.tokens_by_user {
        for token in user.tokens {
            state.remove_apns_token(user.user_id, token);
        }
    }
    Response::Success
}
