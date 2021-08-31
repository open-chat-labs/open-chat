use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::chunk::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn chunk(args: Args) -> Response {
    RUNTIME_STATE.with(|state| chunk_impl(args, state.borrow().as_ref().unwrap()))
}

fn chunk_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    match runtime_state.data.blob_storage.get_chunk(args.blob_id, args.index) {
        None => NotFound,
        Some(bytes) => Success(SuccessResult { bytes: bytes.clone() }),
    }
}
