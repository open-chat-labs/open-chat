use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserIndexEvent;
use stable_memory_map::StableMemoryMap;
use user_index_canister::c2c_sync_blocked_users::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn c2c_sync_blocked_users(args: Args) -> Response {
    mutate_state(|state| c2c_sync_blocked_users_impl(args, state))
}

fn c2c_sync_blocked_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    assert_eq!(state.env.caller(), state.data.notifications_index_canister_id);

    for (user_id, blocked_users) in args.blocked_users {
        for blocked_user in blocked_users {
            state.data.blocked_users.insert((user_id, blocked_user), ());
            state.push_event_to_all_local_user_indexes(UserIndexEvent::UserBlocked(user_id, blocked_user), None);
        }
    }
    Success
}
