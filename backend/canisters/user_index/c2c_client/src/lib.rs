use candid::Principal;
use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use types::{CanisterId, UserDetails};
use user_index_canister::*;

// Queries
generate_c2c_call!(c2c_lookup_user);
generate_candid_c2c_call!(platform_moderators_group);
generate_c2c_call!(user);

// Updates
generate_c2c_call!(c2c_migrate_user_principal);
generate_c2c_call!(c2c_notify_events);
generate_c2c_call!(c2c_set_avatar);
generate_c2c_call!(c2c_suspend_users);
generate_c2c_call!(c2c_register_bot);

#[derive(Debug)]
pub enum LookupUserError {
    UserNotFound,
    InternalError(String),
}

pub async fn lookup_user(
    user_id_or_principal: Principal,
    user_index_canister_id: CanisterId,
) -> Result<UserDetails, LookupUserError> {
    let args = c2c_lookup_user::Args { user_id_or_principal };

    match crate::c2c_lookup_user(user_index_canister_id, &args).await {
        Ok(c2c_lookup_user::Response::Success(user)) => Ok(user),
        Ok(_) => Err(LookupUserError::UserNotFound),
        Err(error) => Err(LookupUserError::InternalError(format!("{error:?}"))),
    }
}
