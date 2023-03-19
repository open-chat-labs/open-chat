use candid::Principal;
use canister_client_macros::*;
use types::{CanisterId, UserDetails};
use user_index_canister::*;

// Queries
generate_c2c_call!(c2c_lookup_principal);
generate_c2c_call!(c2c_lookup_user);
generate_c2c_call!(user);

// Updates
generate_c2c_call!(c2c_migrate_user_principal);
generate_c2c_call!(c2c_notify_events);
generate_c2c_call!(c2c_set_avatar);
generate_c2c_call!(c2c_suspend_users);
generate_c2c_call!(c2c_register_bot);

pub enum LookupUserError {
    UserNotFound,
    InternalError(String),
}

pub async fn lookup_user(caller: Principal, user_index_canister_id: CanisterId) -> Result<UserDetails, LookupUserError> {
    let args = user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: caller,
    };

    match crate::c2c_lookup_user(user_index_canister_id, &args).await {
        Ok(user_index_canister::c2c_lookup_user::Response::Success(user)) => Ok(user),
        Ok(_) => Err(LookupUserError::UserNotFound),
        Err(error) => Err(LookupUserError::InternalError(format!("{error:?}"))),
    }
}
