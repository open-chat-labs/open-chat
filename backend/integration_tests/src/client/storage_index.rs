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
generate_update_call!(update_user_id);
generate_update_call!(upgrade_bucket_canister_wasm);

pub mod happy_path {
    use crate::utils::tick_many;
    use candid::Principal;
    use ic_state_machine_tests::StateMachine;
    use storage_index_canister::add_or_update_users::UserConfig;
    use storage_index_canister::user::UserRecord;
    use types::CanisterId;
    use utils::hasher::hash_bytes;

    pub fn add_or_update_users(env: &mut StateMachine, sender: Principal, canister_id: CanisterId, users: Vec<UserConfig>) {
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
        env: &StateMachine,
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

    pub fn user(env: &StateMachine, sender: Principal, canister_id: CanisterId) -> UserRecord {
        let response = super::user(env, sender, canister_id, &storage_index_canister::user::Args {});

        if let storage_index_canister::user::Response::Success(result) = response {
            result
        } else {
            panic!("'user' error: {response:?}");
        }
    }
}
