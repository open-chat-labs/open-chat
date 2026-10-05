use crate::guards::caller_is_storage_index_canister;
use crate::{RuntimeState, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_user_ids_migrated::*;
use types::SuccessOnly;

// Queues each migrated user's old id to be replaced by their new one among the accessors of the files
// naming it, so that the canister now holding them can delete those files
#[update(guard = "caller_is_storage_index_canister")]
#[trace]
fn c2c_user_ids_migrated(args: Args) -> Response {
    mutate_state(|state| c2c_user_ids_migrated_impl(args, state))
}

fn c2c_user_ids_migrated_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.files.queue_accessor_replacements(
        args.user_ids
            .into_iter()
            .map(|(old_user_id, new_user_id)| (old_user_id.as_principal(), new_user_id.as_principal())),
    );
    crate::jobs::replace_accessors::start_job_if_required(state);
    SuccessOnly::Success
}
