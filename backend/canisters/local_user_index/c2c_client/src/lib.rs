use candid::Principal;
use canister_client::generate_c2c_call;
use constants::CHUNK_STORE_CHUNK_SIZE;
use local_user_index_canister::*;
use std::collections::HashMap;
use types::{C2CError, CanisterId, UserId};

// Queries
generate_c2c_call!(c2c_lookup_user);
generate_c2c_call!(c2c_lookup_users);
generate_c2c_call!(c2c_user_principals);
generate_c2c_call!(chat_events);

// Updates
generate_c2c_call!(c2c_community_canister, 300);
generate_c2c_call!(c2c_create_community);
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_delete_community);
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_group_canister, 300);
generate_c2c_call!(c2c_group_index, 300);
generate_c2c_call!(c2c_notifications_index, 300);
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_notify_user_index_events);
generate_c2c_call!(c2c_push_wasm_chunk);
generate_c2c_call!(c2c_set_community_upgrade_concurrency);
generate_c2c_call!(c2c_set_group_upgrade_concurrency);
generate_c2c_call!(c2c_set_max_concurrent_community_upgrades);
generate_c2c_call!(c2c_set_max_concurrent_group_upgrades);
generate_c2c_call!(c2c_trigger_upgrade);
generate_c2c_call!(c2c_upgrade_community_canister_wasm);
generate_c2c_call!(c2c_upgrade_group_canister_wasm);
generate_c2c_call!(c2c_upgrade_user_canister_wasm);
generate_c2c_call!(c2c_user_canister, 300);
generate_c2c_call!(c2c_verify_signature, 300);
generate_c2c_call!(join_channel);
generate_c2c_call!(join_group);

pub async fn lookup_user(
    user_id_or_principal: Principal,
    local_user_index_canister_id: CanisterId,
) -> Result<Option<GlobalUser>, C2CError> {
    let args = c2c_lookup_user::Args { user_id_or_principal };

    let response = crate::c2c_lookup_user(local_user_index_canister_id, &args).await?;

    Ok(if let c2c_lookup_user::Response::Success(user) = response { Some(user) } else { None })
}

pub async fn push_wasm_in_chunks(
    canister_id: CanisterId,
    canister_type: ChildCanisterType,
    wasm: &[u8],
) -> Result<c2c_push_wasm_chunk::Response, C2CError> {
    for (index, chunk) in wasm.chunks(CHUNK_STORE_CHUNK_SIZE).enumerate() {
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
