use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::active_groups::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn active_groups(args: Args) -> Response {
    RUNTIME_STATE.with(|state| active_groups_impl(args, state.borrow().as_ref().unwrap()))
}

fn active_groups_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let all_deleted = &runtime_state.data.deleted_groups;

    let deleted_groups = args.chat_ids.iter().filter(|id| all_deleted.contains(id)).copied().collect();

    let active_groups = args
        .chat_ids
        .into_iter()
        .filter_map(|id| {
            if let Some(g) = runtime_state.data.private_groups.get(&id) {
                if g.is_active(now) {
                    return Some(g.id());
                }
            } else if let Some(g) = runtime_state.data.public_groups.get(&id) {
                if g.is_active(now) {
                    return Some(g.id());
                }
            }
            None
        })
        .collect();

    Success(SuccessResult {
        active_groups,
        deleted_groups,
    })
}
