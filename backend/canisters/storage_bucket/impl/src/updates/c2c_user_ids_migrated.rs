use crate::guards::caller_is_storage_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_user_ids_migrated::*;
use types::SuccessOnly;

// Records the users migrated to MultiUser canisters, so that the canister now holding a user can
// delete the files which name their old id as an accessor
#[update(guard = "caller_is_storage_index_canister")]
#[trace]
fn c2c_user_ids_migrated(args: Args) -> Response {
    mutate_state(|state| c2c_user_ids_migrated_impl(args, state))
}

fn c2c_user_ids_migrated_impl(args: Args, state: &mut RuntimeState) -> Response {
    for (old_user_id, new_user_id) in args.user_ids {
        state.data.files.add_migrated_user_id(old_user_id, new_user_id);
    }
    SuccessOnly::Success
}
