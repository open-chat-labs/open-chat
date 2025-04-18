use canister_client::generate_c2c_call;
use constants::CHUNK_STORE_CHUNK_SIZE;
use local_group_index_canister::*;
use types::{C2CError, CanisterId};

// Queries
generate_c2c_call!(c2c_can_push_notifications);

// Updates
generate_c2c_call!(c2c_create_community);
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_delete_community);
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_group_index, 300);
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_push_wasm_chunk);
generate_c2c_call!(c2c_set_community_upgrade_concurrency);
generate_c2c_call!(c2c_set_group_upgrade_concurrency);
generate_c2c_call!(c2c_set_max_concurrent_community_upgrades);
generate_c2c_call!(c2c_set_max_concurrent_group_upgrades);
generate_c2c_call!(c2c_trigger_upgrade);
generate_c2c_call!(c2c_upgrade_community_canister_wasm);
generate_c2c_call!(c2c_upgrade_group_canister_wasm);

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
