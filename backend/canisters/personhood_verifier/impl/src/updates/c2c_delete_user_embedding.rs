use crate::guards::caller_is_user_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use personhood_verifier_canister::c2c_delete_user_embedding::*;
use types::SuccessOnly;

// msgpack: called via the user_index fire-and-forget handler and the
// generated c2c client, both of which target the _msgpack method
#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_delete_user_embedding(args: Args) -> Response {
    mutate_state(|state| c2c_delete_user_embedding_impl(args, state))
}

fn c2c_delete_user_embedding_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.embeddings.remove_user(&args.user_id);
    state.data.attempts.remove(&args.user_id);
    state.data.pending_verified_notifications.remove(&args.user_id);
    state.data.sessions.remove_for_user(&args.user_id);
    let sessions = &state.data.sessions;
    state.data.processing_queue.retain(|id| sessions.get(*id).is_some());
    SuccessOnly::Success
}
