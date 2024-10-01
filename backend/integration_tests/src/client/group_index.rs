use crate::{generate_msgpack_query_call, generate_msgpack_update_call, generate_update_call};
use group_index_canister::*;

// Queries
generate_msgpack_query_call!(explore_communities);
generate_msgpack_query_call!(explore_groups);
generate_msgpack_query_call!(search);

// Updates
generate_update_call!(add_local_group_index_canister);
generate_msgpack_update_call!(delete_frozen_group);
generate_msgpack_update_call!(freeze_group);
generate_msgpack_update_call!(unfreeze_group);
generate_update_call!(upgrade_community_canister_wasm);
generate_update_call!(upgrade_group_canister_wasm);
generate_update_call!(upgrade_local_group_index_canister_wasm);
generate_update_call!(upload_wasm_chunk);

pub mod happy_path {
    use crate::User;
    use candid::Principal;
    use group_index_canister::ChildCanisterType;
    use pocket_ic::PocketIc;
    use sha256::sha256;
    use types::{CanisterId, CanisterWasm, CommunityMatch, GroupMatch};

    pub fn explore_communities(env: &PocketIc, sender: &User, group_index_canister_id: CanisterId) -> Vec<CommunityMatch> {
        let response = super::explore_communities(
            env,
            sender.principal,
            group_index_canister_id,
            &group_index_canister::explore_communities::Args {
                search_term: None,
                languages: Vec::new(),
                page_index: 0,
                page_size: 50,
                include_moderation_flags: 0,
            },
        );

        if let group_index_canister::explore_communities::Response::Success(result) = response {
            result.matches
        } else {
            panic!("'explore_communities' error: {response:?}");
        }
    }

    pub fn explore_groups(env: &PocketIc, sender: &User, group_index_canister_id: CanisterId) -> Vec<GroupMatch> {
        let response = super::explore_groups(
            env,
            sender.principal,
            group_index_canister_id,
            &group_index_canister::explore_groups::Args {
                search_term: None,
                page_index: 0,
                page_size: 50,
            },
        );

        if let group_index_canister::explore_groups::Response::Success(result) = response {
            result.matches
        } else {
            panic!("'explore_groups' error: {response:?}");
        }
    }

    pub fn upgrade_local_group_index_canister_wasm(
        env: &mut PocketIc,
        sender: Principal,
        group_index_canister_id: CanisterId,
        wasm: CanisterWasm,
    ) {
        upload_wasm_in_chunks(
            env,
            sender,
            group_index_canister_id,
            &wasm.module,
            ChildCanisterType::LocalGroupIndex,
        );

        let response = super::upgrade_local_group_index_canister_wasm(
            env,
            sender,
            group_index_canister_id,
            &group_index_canister::upgrade_local_group_index_canister_wasm::Args {
                version: wasm.version,
                wasm_hash: sha256(&wasm.module),
                filter: None,
            },
        );

        assert!(matches!(
            response,
            group_index_canister::upgrade_local_group_index_canister_wasm::Response::Success
        ));
    }

    pub fn upgrade_group_canister_wasm(
        env: &mut PocketIc,
        sender: Principal,
        group_index_canister_id: CanisterId,
        wasm: CanisterWasm,
    ) {
        upload_wasm_in_chunks(env, sender, group_index_canister_id, &wasm.module, ChildCanisterType::Group);

        let response = super::upgrade_group_canister_wasm(
            env,
            sender,
            group_index_canister_id,
            &group_index_canister::upgrade_group_canister_wasm::Args {
                version: wasm.version,
                wasm_hash: sha256(&wasm.module),
                filter: None,
            },
        );

        assert!(matches!(
            response,
            group_index_canister::upgrade_group_canister_wasm::Response::Success
        ));
    }

    pub fn upgrade_community_canister_wasm(
        env: &mut PocketIc,
        sender: Principal,
        group_index_canister_id: CanisterId,
        wasm: CanisterWasm,
    ) {
        upload_wasm_in_chunks(
            env,
            sender,
            group_index_canister_id,
            &wasm.module,
            ChildCanisterType::Community,
        );

        let response = super::upgrade_community_canister_wasm(
            env,
            sender,
            group_index_canister_id,
            &group_index_canister::upgrade_community_canister_wasm::Args {
                version: wasm.version,
                wasm_hash: sha256(&wasm.module),
                filter: None,
            },
        );

        assert!(matches!(
            response,
            group_index_canister::upgrade_community_canister_wasm::Response::Success
        ));
    }

    pub fn add_local_group_index_canister(
        env: &mut PocketIc,
        sender: Principal,
        group_index_canister_id: CanisterId,
        local_group_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
    ) {
        let response = super::add_local_group_index_canister(
            env,
            sender,
            group_index_canister_id,
            &group_index_canister::add_local_group_index_canister::Args {
                canister_id: local_group_index_canister_id,
                local_user_index_canister_id,
                notifications_canister_id,
            },
        );

        assert!(matches!(
            response,
            group_index_canister::add_local_group_index_canister::Response::Success
        ));
    }

    fn upload_wasm_in_chunks(
        env: &mut PocketIc,
        sender: Principal,
        group_index_canister_id: CanisterId,
        wasm: &[u8],
        canister_type: ChildCanisterType,
    ) {
        for (index, chunk) in wasm.chunks(1_000_000).enumerate() {
            let response = super::upload_wasm_chunk(
                env,
                sender,
                group_index_canister_id,
                &group_index_canister::upload_wasm_chunk::Args {
                    canister_type,
                    chunk: chunk.to_vec().into(),
                    index: index as u8,
                },
            );
            assert!(matches!(
                response,
                group_index_canister::upload_wasm_chunk::Response::Success(_)
            ));
        }
    }
}
