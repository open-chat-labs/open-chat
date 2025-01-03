use crate::generate_update_call;
use openchat_installer_canister::*;

// Updates
generate_update_call!(install_canisters);
generate_update_call!(upload_wasm_chunk);

pub mod happy_path {
    use candid::Principal;
    use openchat_installer_canister::CanisterType;
    use pocket_ic::PocketIc;
    use types::{BuildVersion, CanisterId, Hash};

    #[allow(clippy::too_many_arguments)]
    pub fn install_canisters(
        env: &mut PocketIc,
        sender: Principal,
        openchat_installer_canister_id: CanisterId,
        user_index_wasm_hash: Hash,
        group_index_wasm_hash: Hash,
        notifications_index_wasm_hash: Hash,
        video_call_operators: Vec<Principal>,
        push_service_principals: Vec<Principal>,
        wasm_version: BuildVersion,
    ) {
        let response = super::install_canisters(
            env,
            sender,
            openchat_installer_canister_id,
            &openchat_installer_canister::install_canisters::Args {
                user_index_wasm_hash,
                group_index_wasm_hash,
                notifications_index_wasm_hash,
                video_call_operators,
                push_service_principals,
                wasm_version,
            },
        );

        assert!(matches!(
            response,
            openchat_installer_canister::install_canisters::Response::Success
        ));
    }

    pub fn upload_wasm_in_chunks(
        env: &mut PocketIc,
        sender: Principal,
        openchat_installer_canister_id: CanisterId,
        wasm: &[u8],
        canister_type: CanisterType,
    ) {
        for (index, chunk) in wasm.chunks(1_000_000).enumerate() {
            let response = super::upload_wasm_chunk(
                env,
                sender,
                openchat_installer_canister_id,
                &openchat_installer_canister::upload_wasm_chunk::Args {
                    canister_type,
                    chunk: chunk.to_vec().into(),
                    index: index as u8,
                },
            );
            assert!(matches!(
                response,
                openchat_installer_canister::upload_wasm_chunk::Response::Success(_)
            ));
        }
    }
}
