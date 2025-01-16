use canister_client::generate_c2c_call;
use ic_cdk::api::call::CallResult;
use local_group_index_canister::*;
use types::CanisterId;

// Queries
generate_c2c_call!(c2c_can_push_notifications);

// Updates
generate_c2c_call!(c2c_create_community);
generate_c2c_call!(c2c_create_group);
generate_c2c_call!(c2c_delete_community);
generate_c2c_call!(c2c_delete_group);
generate_c2c_call!(c2c_notify_low_balance);
generate_c2c_call!(c2c_push_wasm_chunk);
generate_c2c_call!(c2c_notify_group_index_events);
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
) -> CallResult<c2c_push_wasm_chunk::Response> {
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
