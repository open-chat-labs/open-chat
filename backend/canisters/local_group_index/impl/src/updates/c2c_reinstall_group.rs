use crate::guards::caller_is_group_index_canister;
use crate::reinstall_group::reinstall_group;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_reinstall_group::{Response::*, *};
use tracing::error;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_reinstall_group(args: Args) -> Response {
    ic_cdk::spawn(c2c_reinstall_group_impl(args));
    Success
}

async fn c2c_reinstall_group_impl(args: Args) {
    if let Err(error) = reinstall_group(args.group_id).await {
        error!("Failed to reinstall group. Error: {error}");
    }
}
