use crate::guards::caller_is_group_index_canister;
use crate::reinstall_group::reinstall_group;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_reinstall_group::{Response::*, *};
use types::ChatId;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_reinstall_group(args: Args) -> Response {
    ic_cdk::spawn(reinstall_group_impl(args.group_id));
    Success
}

async fn reinstall_group_impl(group_id: ChatId) {
    let _ = reinstall_group(group_id).await;
}
