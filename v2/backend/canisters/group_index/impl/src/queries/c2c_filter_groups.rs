use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_filter_groups::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn c2c_filter_groups(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_active_and_deleted_groups_impl(args, state.borrow().as_ref().unwrap()))
}

fn c2c_active_and_deleted_groups_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let active_since = args.active_in_last.map(|d| runtime_state.env.now().saturating_sub(d));
    let all_deleted = &runtime_state.data.deleted_groups;

    let deleted_groups = args.chat_ids.iter().filter_map(|id| all_deleted.get(id)).copied().collect();

    let mut active_groups = Vec::new();
    let mut upgrades_in_progress = Vec::new();
    for chat_id in args.chat_ids.into_iter() {
        if let Some(g) = runtime_state.data.private_groups.get(&chat_id) {
            if g.upgrade_in_progress() {
                upgrades_in_progress.push(g.id());
            } else if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_groups.push(g.id());
            }
        } else if let Some(g) = runtime_state.data.public_groups.get(&chat_id) {
            if g.upgrade_in_progress() {
                upgrades_in_progress.push(g.id());
            } else if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_groups.push(g.id());
            }
        }
    }

    Success(SuccessResult {
        active_groups,
        upgrades_in_progress,
        deleted_groups,
    })
}
