use crate::{generate_query_call, generate_update_call};
use storage_index_canister::*;

// Queries
generate_query_call!(allocated_bucket_v2);
generate_query_call!(can_forward);
generate_query_call!(user);

// Updates
generate_update_call!(add_or_update_users);
generate_update_call!(remove_accessor);
generate_update_call!(remove_user);
generate_update_call!(upgrade_bucket_canister_wasm);

pub mod happy_path {
    use crate::utils::tick_many;
    use candid::Principal;
    use pocket_ic::PocketIc;
    use storage_index_canister::add_or_update_users::UserConfig;
    use storage_index_canister::user::UserRecord;
    use types::{CanisterId, CanisterWasm};
    use utils::hasher::hash_bytes;

    pub fn add_or_update_users(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, users: Vec<UserConfig>) {
        let response = super::add_or_update_users(
            env,
            sender,
            canister_id,
            &storage_index_canister::add_or_update_users::Args { users },
        );

        assert!(matches!(
            response,
            storage_index_canister::add_or_update_users::Response::Success
        ));

        // Tick a few times to propagate the users to the buckets and finalize state
        tick_many(env, 5);
    }

    pub fn allocated_bucket(
        env: &PocketIc,
        sender: Principal,
        canister_id: CanisterId,
        file: &[u8],
    ) -> storage_index_canister::allocated_bucket_v2::SuccessResult {
        let file_hash = hash_bytes(file);
        let file_size = file.len() as u64;

        let response = super::allocated_bucket_v2(
            env,
            sender,
            canister_id,
            &storage_index_canister::allocated_bucket_v2::Args {
                file_hash,
                file_size,
                file_id_seed: None,
            },
        );

        if let storage_index_canister::allocated_bucket_v2::Response::Success(result) = response {
            result
        } else {
            panic!("'allocated_bucket_v2' error: {response:?}");
        }
    }

    pub fn user(env: &PocketIc, sender: Principal, canister_id: CanisterId) -> UserRecord {
        let response = super::user(env, sender, canister_id, &storage_index_canister::user::Args {});

        if let storage_index_canister::user::Response::Success(result) = response {
            result
        } else {
            panic!("'user' error: {response:?}");
        }
    }

    pub fn upgrade_notifications_canister_wasm(
        env: &mut PocketIc,
        sender: Principal,
        storage_index_canister_id: CanisterId,
        wasm: CanisterWasm,
    ) {
        let response = super::upgrade_bucket_canister_wasm(
            env,
            sender,
            storage_index_canister_id,
            &storage_index_canister::upgrade_bucket_canister_wasm::Args { wasm, filter: None },
        );

        assert!(matches!(
            response,
            storage_index_canister::upgrade_bucket_canister_wasm::Response::Success
        ));
    }
}
