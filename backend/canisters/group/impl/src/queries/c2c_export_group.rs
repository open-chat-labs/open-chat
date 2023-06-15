use crate::guards::caller_is_community_being_imported_into;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use group_canister::c2c_export_group::{Response::*, *};

#[query_msgpack(guard = "caller_is_community_being_imported_into")]
fn c2c_export_group(args: Args) -> Response {
    read_state(|state| c2c_export_group_impl(args, state))
}

fn c2c_export_group_impl(args: Args, state: &RuntimeState) -> Response {
    let from = args.from as usize;
    let to = from + args.page_size as usize;
    let page = state
        .data
        .serialized_chat_state
        .as_ref()
        .map(|bytes| bytes[from..to].to_vec())
        .unwrap_or_default();

    Success(page)
}
