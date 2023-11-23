use crate::generate_update_call;
use notifications_index_canister::*;

// Queries

// Updates
generate_update_call!(add_notifications_canister);
generate_update_call!(push_subscription);
generate_update_call!(upgrade_notifications_canister_wasm);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, CanisterWasm};

    pub fn upgrade_notifications_canister_wasm(
        env: &mut PocketIc,
        sender: Principal,
        notifications_index_canister_id: CanisterId,
        wasm: CanisterWasm,
    ) {
        let response = super::upgrade_notifications_canister_wasm(
            env,
            sender,
            notifications_index_canister_id,
            &notifications_index_canister::upgrade_notifications_canister_wasm::Args {
                wasm,
                filter: None,
                use_for_new_canisters: None,
            },
        );

        assert!(matches!(
            response,
            notifications_index_canister::upgrade_notifications_canister_wasm::Response::Success
        ));
    }

    pub fn add_notifications_canister(
        env: &mut PocketIc,
        sender: Principal,
        notifications_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        local_group_index_canister_id: CanisterId,
    ) {
        let response = super::add_notifications_canister(
            env,
            sender,
            notifications_index_canister_id,
            &notifications_index_canister::add_notifications_canister::Args {
                canister_id: notifications_canister_id,
                authorizers: vec![local_user_index_canister_id, local_group_index_canister_id],
            },
        );

        assert!(matches!(
            response,
            notifications_index_canister::add_notifications_canister::Response::Success
        ));
    }
}
