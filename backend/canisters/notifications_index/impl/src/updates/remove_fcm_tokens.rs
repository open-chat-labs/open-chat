use crate::guards::caller_is_push_service;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::remove_fcm_tokens::*;

#[update(guard = "caller_is_push_service", msgpack = true)]
#[trace]
fn remove_fcm_tokens(args: Args) -> Response {
    mutate_state(|state| remove_fcm_tokens_impl(args, state))
}

fn remove_fcm_tokens_impl(args: Args, state: &mut RuntimeState) -> Response {
    for user in args.tokens_by_user {
        for token in user.tokens {
            // Best-effort: a token may already be gone (e.g. re-registered), in
            // which case remove returns an error we can safely ignore.
            let _ = state.remove_fcm_token(user.user_id, token);
        }
    }
    Response::Success
}
