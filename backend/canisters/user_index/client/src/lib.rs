use canister_client::{generate_query_call, generate_update_call};
use ic_agent::Agent;
use types::CanisterId;
use user_index_canister::*;

// Queries
generate_query_call!(check_username);
generate_query_call!(current_user);
generate_query_call!(search);
generate_query_call!(platform_moderators);
generate_query_call!(platform_operators);
generate_query_call!(user);

// Updates
generate_update_call!(add_local_user_index_canister);
generate_update_call!(add_platform_moderator);
generate_update_call!(add_platform_operator);
generate_update_call!(remove_sms_messages);
generate_update_call!(remove_platform_moderator);
generate_update_call!(remove_platform_operator);
generate_update_call!(set_username);
generate_update_call!(upgrade_local_user_index_canister_wasm);
generate_update_call!(upgrade_user_canister_wasm);
generate_update_call!(upload_wasm_chunk);

pub async fn upload_wasm_in_chunks(
    agent: &Agent,
    canister_id: &CanisterId,
    wasm: &[u8],
    canister_type: ChildCanisterType,
) -> Result<(), Box<dyn std::error::Error + Sync + Send>> {
    for (index, chunk) in wasm.chunks(1_000_000).enumerate() {
        let response = upload_wasm_chunk(
            agent,
            canister_id,
            &upload_wasm_chunk::Args {
                canister_type,
                chunk: chunk.to_vec().into(),
                index: index as u8,
            },
        )
        .await?;

        if let upload_wasm_chunk::Response::UnexpectedIndex(expected_index) = response {
            return Err(format!("Unexpected index. Provided: {index}. Expected: {expected_index}").into());
        }
    }
    Ok(())
}
