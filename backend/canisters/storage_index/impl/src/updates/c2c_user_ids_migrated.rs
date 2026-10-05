use crate::guards::caller_is_user_controller;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_index_canister::c2c_user_ids_migrated::*;
use types::SuccessOnly;

// Records the users migrated to MultiUser canisters and passes them on to every bucket, so that the
// canister now holding a user can delete the files which name their old id as an accessor
#[update(guard = "caller_is_user_controller")]
#[trace]
fn c2c_user_ids_migrated(args: Args) -> Response {
    mutate_state(|state| c2c_user_ids_migrated_impl(args, state))
}

fn c2c_user_ids_migrated_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_ids: Vec<_> = args
        .user_ids
        .into_iter()
        .filter(|(old_user_id, new_user_id)| state.data.migrated_user_ids.insert(*old_user_id, *new_user_id))
        .collect();

    state.push_user_ids_migrated_to_buckets(user_ids);
    SuccessOnly::Success
}
