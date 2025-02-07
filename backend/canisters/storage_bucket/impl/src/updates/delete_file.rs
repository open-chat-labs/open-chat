use crate::model::files::RemoveFileResult;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_bucket_canister::delete_file::{Response::*, *};

#[update(candid = true, json = true, msgpack = true)]
#[trace]
fn delete_file(args: Args) -> Response {
    mutate_state(|state| delete_file_impl(args, state))
}

fn delete_file_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    match state.data.remove_file(caller, args.file_id) {
        RemoveFileResult::Success(_) => {
            crate::jobs::remove_expired_files::start_job_if_required(state);
            Success
        }
        RemoveFileResult::NotAuthorized => NotAuthorized,
        RemoveFileResult::NotFound => NotFound,
    }
}
