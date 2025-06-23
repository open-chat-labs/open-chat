mod add_fcm_token;
mod notify_local_index_added;
mod push_subscription;
mod remove_subscription;
mod remove_subscriptions;
mod remove_subscriptions_for_user;
mod wallet_receive;

use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use stable_memory_map::StableMemoryMap;
use types::{CanisterId, UserId};
use user_index_canister::c2c_lookup_user::Response;
use user_index_canister_c2c_client::c2c_lookup_user;

pub(crate) enum LookupResult {
    Found(UserId),
    NotFound((Principal, CanisterId)),
}

pub(crate) enum LookupError {
    UserNotFound,
    InternalError(String),
}

impl ToString for LookupError {
    fn to_string(&self) -> String {
        match self {
            LookupError::UserNotFound => "User not found".to_string(),
            LookupError::InternalError(msg) => format!("Internal error: {}", msg),
        }
    }
}

pub(crate) async fn get_user_id() -> Result<UserId, LookupError> {
    match read_state(lookup_user_locally) {
        LookupResult::Found(user_id) => Ok(user_id),
        LookupResult::NotFound((user_principal, user_index_canister_id)) => {
            let c2c_lookup_user_args = user_index_canister::c2c_lookup_user::Args {
                user_id_or_principal: user_principal,
            };
            match c2c_lookup_user(user_index_canister_id, &c2c_lookup_user_args).await {
                Ok(Response::Success(user)) => {
                    mutate_state(|state| add_user_locally(user_principal, user.user_id, state));
                    Ok(user.user_id)
                }
                Ok(Response::UserNotFound) => Err(LookupError::UserNotFound),
                Ok(Response::Error(..)) => Err(LookupError::UserNotFound),
                Err(error) => Err(LookupError::InternalError(format!(
                    "Failed to call 'user_index::c2c_lookup_user': {error:?}"
                ))),
            }
        }
    }
}

fn lookup_user_locally(state: &RuntimeState) -> LookupResult {
    let caller = state.env.caller();
    if let Some(user_id) = state.data.principal_to_user_id_map.get(&caller) {
        LookupResult::Found(user_id)
    } else {
        LookupResult::NotFound((caller, state.data.user_index_canister_id))
    }
}

fn add_user_locally(principal: Principal, user_id: UserId, state: &mut RuntimeState) {
    state.data.principal_to_user_id_map.insert(principal, user_id);
}
