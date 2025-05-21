use candid::Principal;
use canister_client::generate_c2c_call;
use types::{C2CError, CanisterId, UserDetails};
use user_index_canister::*;

// Queries
generate_c2c_call!(c2c_lookup_user);
generate_c2c_call!(platform_moderators_group);
generate_c2c_call!(user);
generate_c2c_call!(users_chit);

// Updates
generate_c2c_call!(add_local_user_index_canister);
generate_c2c_call!(c2c_delete_user);
generate_c2c_call!(c2c_local_user_index, 300);
generate_c2c_call!(c2c_mark_user_canister_empty);
generate_c2c_call!(c2c_notify_chit);
generate_c2c_call!(c2c_report_message);
generate_c2c_call!(c2c_send_openchat_bot_messages);
generate_c2c_call!(c2c_set_avatar);
generate_c2c_call!(c2c_suspend_users);

pub async fn lookup_user(
    user_id_or_principal: Principal,
    user_index_canister_id: CanisterId,
) -> Result<Option<UserDetails>, C2CError> {
    let args = c2c_lookup_user::Args { user_id_or_principal };

    let response = crate::c2c_lookup_user(user_index_canister_id, &args).await?;

    Ok(if let c2c_lookup_user::Response::Success(user) = response { Some(user) } else { None })
}
