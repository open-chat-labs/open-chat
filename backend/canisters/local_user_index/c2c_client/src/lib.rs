use std::collections::HashMap;

use candid::Principal;
use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use local_user_index_canister::*;
use types::{CanisterId, UserId};

// Queries
generate_c2c_call!(c2c_can_push_notifications);
generate_c2c_call!(c2c_diamond_membership_expiry_dates);
generate_c2c_call!(c2c_lookup_user);
generate_c2c_call!(c2c_lookup_users);
generate_c2c_call!(c2c_user_principals);
generate_c2c_call!(chat_events);

// Updates
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_notify_user_index_events);
generate_c2c_call!(c2c_upgrade_user_canister_wasm);
generate_candid_c2c_call!(join_channel);
generate_candid_c2c_call!(join_group);

#[derive(Debug)]
pub enum LookupUserError {
    UserNotFound,
    InternalError(String),
}

pub async fn lookup_user(
    user_id_or_principal: Principal,
    local_user_index_canister_id: CanisterId,
) -> Result<GlobalUser, LookupUserError> {
    let args = c2c_lookup_user::Args { user_id_or_principal };

    match crate::c2c_lookup_user(local_user_index_canister_id, &args).await {
        Ok(c2c_lookup_user::Response::Success(user)) => Ok(user),
        Ok(_) => Err(LookupUserError::UserNotFound),
        Err(error) => Err(LookupUserError::InternalError(format!("{error:?}"))),
    }
}

pub async fn lookup_users(
    user_ids: Vec<UserId>,
    local_user_index_canister_id: CanisterId,
) -> Result<HashMap<UserId, GlobalUser>, String> {
    let args = c2c_lookup_users::Args { user_ids };

    match crate::c2c_lookup_users(local_user_index_canister_id, &args).await {
        Ok(c2c_lookup_users::Response::Success(users)) => Ok(users),
        Err(error) => Err(format!("{error:?}")),
    }
}
