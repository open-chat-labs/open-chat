use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::info;
use types::SuccessOnly::Success;
use user_index_canister::remove_unique_person_proof::*;

// Right to erasure: removes the caller's unique person proof (fanned out to
// the local user indexes and their user canister) and deletes their face
// embedding + attempt history from the personhood verifier. Idempotent, and
// the embedding deletion runs even when no proof exists so an enrolment
// whose proof notification is still in flight cannot leave biometric data
// behind.
#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn remove_unique_person_proof(_args: Args) -> Response {
    mutate_state(remove_unique_person_proof_impl)
}

fn remove_unique_person_proof_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = state.data.users.get(&caller).unwrap().user_id;
    if state.remove_unique_person_proof(user_id) {
        info!(%user_id, "Unique person proof removed at user's request");
    }
    state.delete_user_embedding(user_id);
    Success
}
