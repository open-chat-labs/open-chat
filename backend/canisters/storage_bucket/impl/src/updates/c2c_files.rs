use crate::guards::caller_is_storage_index_canister;
use crate::{RuntimeState, read_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::c2c_files::{Response::*, *};

#[update(guard = "caller_is_storage_index_canister")]
#[trace]
fn c2c_files(args: Args) -> Response {
    read_state(|state| c2c_files_impl(args, state))
}

fn c2c_files_impl(args: Args, state: &RuntimeState) -> Response {
    let (files, next) = state.data.files.files_after(args.after, args.max_count as usize);

    Success(SuccessResult { files, next })
}
