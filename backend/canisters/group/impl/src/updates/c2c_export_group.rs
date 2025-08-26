use crate::guards::caller_is_community_being_imported_into;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use group_canister::c2c_export_group::{Response::*, *};
use serde_bytes::ByteBuf;
use std::cmp::min;

#[update(guard = "caller_is_community_being_imported_into", msgpack = true)]
fn c2c_export_group(args: Args) -> Response {
    execute_update(|state| c2c_export_group_impl(args, state))
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
