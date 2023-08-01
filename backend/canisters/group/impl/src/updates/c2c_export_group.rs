use crate::guards::caller_is_community_being_imported_into;
use crate::RuntimeState;
use crate::{read_state, run_regular_jobs};
use canister_api_macros::update_msgpack;
use group_canister::c2c_export_group::{Response::*, *};
use serde_bytes::ByteBuf;
use std::cmp::min;

#[update_msgpack(guard = "caller_is_community_being_imported_into")]
fn c2c_export_group(args: Args) -> Response {
    run_regular_jobs();

    read_state(|state| c2c_export_group_impl(args, state))
}

fn c2c_export_group_impl(args: Args, state: &RuntimeState) -> Response {
    let from = args.from as usize;
    let to = from + args.page_size as usize;
    let page = state
        .data
        .serialized_chat_state
        .as_ref()
        .map(|bytes| ByteBuf::from(bytes[from..(min(to, bytes.len()))].to_vec()))
        .unwrap_or_default();

    Success(page)
}
