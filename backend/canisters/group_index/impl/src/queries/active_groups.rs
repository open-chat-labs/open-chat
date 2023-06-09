use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use group_index_canister::active_groups::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn active_groups(args: Args) -> Response {
    read_state(|state| active_groups_impl(args, state))
}

#[query_msgpack]
fn c2c_active_groups(args: group_index_canister::c2c_active_groups::Args) -> group_index_canister::c2c_active_groups::Response {
    read_state(|state| {
        active_groups_impl(
            Args {
                group_ids: args.group_ids,
                community_ids: args.community_ids,
                active_since: args.active_in_last.map(|d| state.env.now().saturating_sub(d)),
            },
            state,
        )
    })
}

fn active_groups_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();
    let active_since = args.active_since;
    let all_deleted_groups = &state.data.deleted_groups;
    let all_deleted_communities = &state.data.deleted_communities;

    let deleted_groups = args
        .group_ids
        .iter()
        .filter_map(|id| all_deleted_groups.get(id))
        .cloned()
        .collect();
    let deleted_communities = args
        .community_ids
        .iter()
        .filter_map(|id| all_deleted_communities.get(id))
        .cloned()
        .collect();

    let mut active_groups = Vec::new();
    for chat_id in args.group_ids {
        if let Some(g) = state.data.private_groups.get(&chat_id) {
            if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_groups.push(g.id());
            }
        } else if let Some(g) = state.data.public_groups.get(&chat_id) {
            if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_groups.push(g.id());
            }
        }
    }

    let mut active_communities = Vec::new();
    for community_id in args.community_ids {
        if let Some(g) = state.data.private_communities.get(&community_id) {
            if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_communities.push(g.id());
            }
        } else if let Some(g) = state.data.public_communities.get(&community_id) {
            if active_since.map(|t| g.has_been_active_since(t)).unwrap_or_default() {
                active_communities.push(g.id());
            }
        }
    }

    Success(SuccessResult {
        timestamp: now,
        active_groups,
        active_communities,
        deleted_groups,
        deleted_communities,
    })
}
