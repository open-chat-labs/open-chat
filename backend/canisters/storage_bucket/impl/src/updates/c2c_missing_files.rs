use crate::guards::caller_is_storage_index_canister;
use crate::{RuntimeState, read_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_missing_files::{Response::*, *};

#[update(guard = "caller_is_storage_index_canister")]
#[trace]
fn c2c_missing_files(args: Args) -> Response {
    read_state(|state| c2c_missing_files_impl(args, state))
}

fn c2c_missing_files_impl(args: Args, state: &RuntimeState) -> Response {
    let mut missing = Vec::new();
    let mut mismatched = Vec::new();
    for file in args.files {
        match state.data.files.owner_and_created(&file.file_id) {
            None => missing.push(file.file_id),
            Some(held) if held != (file.owner, file.created) => mismatched.push(file),
            Some(_) => {}
        }
    }

    Success(SuccessResult { missing, mismatched })
}
