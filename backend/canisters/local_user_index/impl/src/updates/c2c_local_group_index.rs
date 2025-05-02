use crate::guards::caller_is_local_group_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::LocalGroupIndexEvent;
use local_user_index_canister::c2c_local_group_index::*;

#[update(guard = "caller_is_local_group_index", msgpack = true)]
#[trace]
fn c2c_local_group_index(args: Args) -> Response {
    mutate_state(|state| c2c_local_group_index_impl(args, state))
}

fn c2c_local_group_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state.data.idempotency_checker.check(
            state.data.local_group_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            match event.value {
                LocalGroupIndexEvent::MigrateGroup(chat_id, group) => state.data.local_groups.add_existing(chat_id, group),
                LocalGroupIndexEvent::MigrateCommunity(community_id, community) => {
                    state.data.local_communities.add_existing(community_id, community)
                }
                LocalGroupIndexEvent::MigrateEmptyCanister(canister_id) => state.data.canister_pool.push(canister_id),
                LocalGroupIndexEvent::GroupRemoved(chat_id) => {
                    state.data.local_groups.delete(&chat_id);
                }
                LocalGroupIndexEvent::CommunityRemoved(community_id) => {
                    state.data.local_communities.delete(&community_id);
                }
                LocalGroupIndexEvent::MarkTopUp(canister_id, top_up) => {
                    if !state
                        .data
                        .local_groups
                        .mark_cycles_top_up(&canister_id.into(), top_up.clone())
                    {
                        state.data.local_communities.mark_cycles_top_up(&canister_id.into(), top_up);
                    }
                }
            }
        }
    }
    Response::Success
}
