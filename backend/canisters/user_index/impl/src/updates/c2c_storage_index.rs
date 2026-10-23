use crate::guards::caller_is_storage_index;
use crate::updates::c2c_csam_upload_detected::c2c_csam_upload_detected_impl;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_index_canister::StorageIndexEvent;
use user_index_canister::c2c_storage_index::*;

#[update(guard = "caller_is_storage_index", msgpack = true)]
#[trace]
fn c2c_storage_index(args: Args) -> Response {
    mutate_state(|state| c2c_storage_index_impl(args, state))
}

fn c2c_storage_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.storage_index_canister_id, event.created_at, event.idempotency_id)
        {
            match event.value {
                StorageIndexEvent::CsamUploadDetected(m) => c2c_csam_upload_detected_impl(vec![m], state),
            }
        }
    }
    Response::Success
}
