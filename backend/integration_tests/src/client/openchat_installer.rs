use crate::generate_update_call;
use openchat_installer_canister::*;

// Updates
generate_update_call!(install_canisters);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{BuildVersion, CanisterId, Hash};

    pub fn install_canisters(
        env: &mut PocketIc,
        sender: Principal,
        openchat_installer_canister_id: CanisterId,
        user_index_wasm_hash: Hash,
        video_call_operators: Vec<Principal>,
        wasm_version: BuildVersion,
    ) {
        let response = super::install_canisters(
            env,
            sender,
            openchat_installer_canister_id,
            &openchat_installer_canister::install_canisters::Args {
                user_index_wasm_hash,
                video_call_operators,
                wasm_version,
            },
        );

        assert!(matches!(
            response,
            openchat_installer_canister::install_canisters::Response::Success
        ));
    }
}
