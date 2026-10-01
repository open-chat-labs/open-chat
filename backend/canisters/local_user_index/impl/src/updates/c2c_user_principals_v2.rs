use crate::guards::caller_is_local_community_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_user_principals_v2::{Response::*, *};
use std::collections::HashMap;
use types::UserIdAndPrincipal;

// Called by a community importing a group, for the members of the group it adds. Each is found by
// their latest id, since the group may hold them by an id they've since been migrated from, in which
// case the community moves them onto it. One who hasn't been migrated is recorded as having joined
// the community, so that it's told their new id if they turn out to be being migrated (see
// `RecentJoins`).
#[update(guard = "caller_is_local_community_canister", msgpack = true)]
#[trace]
fn c2c_user_principals_v2(args: Args) -> Response {
    mutate_state(|state| c2c_user_principals_v2_impl(args, state))
}

fn c2c_user_principals_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    let community_id = state.env.caller();
    let now = state.env.now();
    let mut users = HashMap::new();

    for user_id in args.user_ids {
        let latest_user_id = state.data.migrated_user_ids.latest(user_id);
        if let Some(user) = state.data.global_users.get_by_user_id(&latest_user_id) {
            if latest_user_id == user_id && !user.user_type.is_bot() {
                state.data.recent_joins.push(user_id, community_id, now);
            }
            users.insert(user_id, UserIdAndPrincipal::new(latest_user_id, user.principal));
        }
    }

    Success(users)
}
