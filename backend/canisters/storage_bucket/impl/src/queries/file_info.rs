use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::query;
use storage_bucket_canister::file_info::{Response::*, *};

#[query]
#[trace]
fn file_info(args: Args) -> Response {
    read_state(|state| file_info_impl(args, state))
}

fn file_info_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(file) = state.data.files.get(&args.file_id) {
        if let Some(file_size) = state.data.files.data_size(&file.hash) {
            return Success(SuccessResult {
                is_owner: file.owner == state.env.caller(),
                file_hash: file.hash,
                file_size,
            });
        }
    }

    NotFound
}
