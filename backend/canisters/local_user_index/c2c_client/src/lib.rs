use candid::Principal;
use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use local_user_index_canister::*;
use types::CanisterId;

// Queries
generate_c2c_call!(c2c_can_push_notifications);
generate_c2c_call!(c2c_lookup_user);
generate_c2c_call!(c2c_user_principals);

// Updates
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_notify_user_index_events);
generate_c2c_call!(c2c_upgrade_user_canister_wasm);

generate_candid_c2c_call!(join_group);

#[derive(Debug)]
pub enum LookupUserError {
    UserNotFound,
    InternalError(String),
}

pub async fn lookup_user(caller: Principal, user_index_canister_id: CanisterId) -> Result<GlobalUser, LookupUserError> {
    let args = local_user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: caller,
    };

    match crate::c2c_lookup_user(user_index_canister_id, &args).await {
        Ok(local_user_index_canister::c2c_lookup_user::Response::Success(user)) => Ok(user),
        Ok(_) => Err(LookupUserError::UserNotFound),
        Err(error) => Err(LookupUserError::InternalError(format!("{error:?}"))),
    }
}
