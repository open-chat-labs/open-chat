use candid::Principal;
use canister_client::generate_c2c_call;
use ic_cdk::call::RejectCode;
use local_user_index_canister::*;
use std::collections::HashMap;
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
generate_c2c_call!(c2c_push_wasm_chunk);
generate_c2c_call!(c2c_upgrade_user_canister_wasm);
generate_c2c_call!(c2c_user_canister, 60);
generate_c2c_call!(join_channel);
generate_c2c_call!(join_group);

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

pub async fn push_wasm_in_chunks(
    canister_id: CanisterId,
    canister_type: ChildCanisterType,
    wasm: &[u8],
) -> Result<c2c_push_wasm_chunk::Response, (RejectCode, String)> {
    for (index, chunk) in wasm.chunks(1_000_000).enumerate() {
        let response = c2c_push_wasm_chunk(
            canister_id,
            &c2c_push_wasm_chunk::Args {
                canister_type,
                chunk: chunk.to_vec().into(),
                index: index as u8,
            },
        )
        .await?;

        if !matches!(response, c2c_push_wasm_chunk::Response::Success) {
            return Ok(response);
        }
    }
    Ok(c2c_push_wasm_chunk::Response::Success)
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
