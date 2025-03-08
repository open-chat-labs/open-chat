use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::SECOND_IN_MS;
use event_store_producer::EventBuilder;
use online_users_canister::mark_as_online::{Response::*, *};
use stable_memory_map::StableMemoryMap;
use types::{CanisterId, UserId};

#[update(msgpack = true)]
#[trace]
async fn mark_as_online(_args: Args) -> Response {
    let user_id = match read_state(try_get_user_id_locally) {
        Ok(u) => u,
        Err((p, user_index_canister_id)) => {
            let c2c_args = user_index_canister::c2c_lookup_user::Args { user_id_or_principal: p };
            match user_index_canister_c2c_client::c2c_lookup_user(user_index_canister_id, &c2c_args).await {
                Ok(user_index_canister::c2c_lookup_user::Response::Success(res)) => {
                    mutate_state(|state| state.data.principal_to_user_id_map.insert(p, res.user_id));
                    res.user_id
                }
                Ok(_) => return UserNotFound,
                Err(error) => return InternalError(format!("{error:?}")),
            }
        }
    };

    mutate_state(|state| mark_as_online_impl(user_id, state))
}

fn try_get_user_id_locally(state: &RuntimeState) -> Result<UserId, (Principal, CanisterId)> {
    let caller = state.env.caller();
    state
        .data
        .principal_to_user_id_map
        .get(&caller)
        .ok_or((caller, state.data.user_index_canister_id))
}

fn mark_as_online_impl(user_id: UserId, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    if let Some(last_online) = state.data.last_online_dates.mark_online(user_id, now) {
        // We only increment the `user_online_minutes` if there has been at least 50 seconds since
        // the user was last marked online.
        // Users are marked online every minute, but by requiring slightly less than a minute we
        // cater for the fact that some requests take longer than others to be processed, but we
        // also avoid double counting for users who are on multiple devices simultaneously.
        if now.saturating_sub(last_online) > 50 * SECOND_IN_MS {
            state.data.user_online_minutes.incr(user_id, now);
        }
    }
    state.data.mark_as_online_count += 1;
    state.data.event_store_client.push(
        EventBuilder::new("user_online", now)
            .with_user(user_id.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .build(),
    );
    Success
}
