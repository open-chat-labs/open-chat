use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use group_index_canister::filter_groups::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn filter_groups(args: Args) -> Response {
    read_state(|state| filter_groups_impl(args, state))
}

#[query_msgpack]
fn c2c_filter_groups(args: group_index_canister::c2c_filter_groups::Args) -> group_index_canister::c2c_filter_groups::Response {
    read_state(|state| {
        filter_groups_impl(
            Args {
                chat_ids: args.chat_ids,
                active_since: args.active_in_last.map(|d| state.env.now().saturating_sub(d)),
            },
            state,
        )
    })
}

fn filter_groups_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let active_since = args.active_since;
    let all_deleted = &runtime_state.data.deleted_groups;

    let deleted_groups = args.chat_ids.iter().filter_map(|id| all_deleted.get(id)).cloned().collect();

    let mut active_groups = Vec::new();
    for chat_id in args.chat_ids {
        if let Some(g) = runtime_state.data.private_groups.get(&chat_id) {
            if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_groups.push(g.id());
            }
        } else if let Some(g) = runtime_state.data.public_groups.get(&chat_id) {
            if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_groups.push(g.id());
            }
        }
    }

    Success(SuccessResult {
        timestamp: now,
        active_groups,
        deleted_groups,
        upgrades_in_progress: Vec::new(),
    })
}
