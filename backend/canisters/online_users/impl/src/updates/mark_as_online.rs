use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use online_users_canister::mark_as_online::{Response::*, *};
use types::{CanisterId, UserId};

#[update]
#[trace]
async fn mark_as_online(_args: Args) -> Response {
    let (principal, user_id) = match read_state(try_get_user_id_locally) {
        Ok((p, u)) => (p, u),
        Err((p, user_index_canister_id)) => {
            let c2c_args = user_index_canister::c2c_lookup_user::Args { user_id_or_principal: p };
            match user_index_canister_c2c_client::c2c_lookup_user(user_index_canister_id, &c2c_args).await {
                Ok(user_index_canister::c2c_lookup_user::Response::Success(res)) => {
                    mutate_state(|state| state.data.principal_to_user_id_map.add(p, res.user_id));
                    (p, res.user_id)
                }
                Ok(_) => return UserNotFound,
                Err(error) => return InternalError(format!("{error:?}")),
            }
        }
    };

    mutate_state(|state| mark_as_online_impl(principal, user_id, state))
}

fn try_get_user_id_locally(runtime_state: &RuntimeState) -> Result<(Principal, UserId), (Principal, CanisterId)> {
    let caller = runtime_state.env.caller();
    runtime_state
        .data
        .principal_to_user_id_map
        .get(&caller)
        .map(|u| (caller, u))
        .ok_or((caller, runtime_state.data.user_index_canister_id))
}

fn mark_as_online_impl(principal: Principal, user_id: UserId, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.online_users.push(principal);
    runtime_state
        .data
        .last_online_dates
        .mark_online(user_id, runtime_state.env.now());
    runtime_state.data.mark_as_online_count += 1;
    Success
}
