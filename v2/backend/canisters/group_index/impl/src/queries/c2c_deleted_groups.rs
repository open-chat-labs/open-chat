use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_deleted_groups::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn c2c_deleted_groups(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_deleted_groups_impl(args, state.borrow().as_ref().unwrap()))
}

fn c2c_deleted_groups_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let all_deleted = &runtime_state.data.deleted_groups;

    let deleted_groups = args.chat_ids.iter().filter_map(|id| all_deleted.get(id)).copied().collect();

    Success(SuccessResult { deleted_groups })
}
