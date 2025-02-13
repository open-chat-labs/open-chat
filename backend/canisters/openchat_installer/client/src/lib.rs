use canister_client::generate_candid_update_call;
use ic_agent::Agent;
use openchat_installer_canister::*;
use types::CanisterId;

// Queries

// Updates
generate_candid_update_call!(install_canisters);
generate_candid_update_call!(upgrade_canister);
generate_candid_update_call!(upload_wasm_chunk);

pub async fn upload_wasm_in_chunks(
    agent: &Agent,
    canister_id: &CanisterId,
    wasm: &[u8],
    canister_type: CanisterType,
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
