use crate::{generate_msgpack_query_call, generate_msgpack_update_call, generate_query_call, generate_update_call};
use user_index_canister::*;

// Queries
generate_msgpack_query_call!(check_username);
generate_msgpack_query_call!(current_user);
generate_msgpack_query_call!(search);
generate_msgpack_query_call!(platform_moderators);
generate_msgpack_query_call!(platform_moderators_group);
generate_query_call!(public_key);
generate_msgpack_query_call!(user);
generate_msgpack_query_call!(user_registration_canister);
generate_msgpack_query_call!(users);
generate_msgpack_query_call!(users_chit);
generate_msgpack_query_call!(bot_updates);
generate_msgpack_query_call!(explore_bots);

// Updates
generate_update_call!(add_local_user_index_canister);
generate_update_call!(add_platform_moderator);
generate_update_call!(add_platform_operator);
generate_update_call!(assign_platform_moderators_group);
generate_msgpack_update_call!(delete_user);
generate_msgpack_update_call!(pay_for_diamond_membership);
generate_msgpack_update_call!(remove_bot);
generate_update_call!(remove_platform_moderator);
generate_msgpack_update_call!(set_display_name);
generate_msgpack_update_call!(set_username);
generate_msgpack_update_call!(suspend_user);
generate_msgpack_update_call!(update_diamond_membership_subscription);
generate_msgpack_update_call!(unsuspend_user);
generate_update_call!(upgrade_local_user_index_canister_wasm);
generate_update_call!(upgrade_user_canister_wasm);
generate_update_call!(upload_wasm_chunk);
generate_msgpack_update_call!(register_bot);
generate_msgpack_update_call!(publish_bot);
generate_msgpack_update_call!(update_bot);

pub mod happy_path {
    use candid::Principal;
    use event_store_canister::TimestampMillis;
    use pocket_ic::PocketIc;
    use sha256::sha256;
    use std::collections::HashMap;
    use testing::rng::random_principal;
    use types::{
        BotDefinition, CanisterId, CanisterWasm, Chit, Cryptocurrency, DiamondMembershipFees, DiamondMembershipPlanDuration,
        Empty, OptionUpdate, UserId, UserSummary,
    };
    use user_index_canister::users::UserGroup;
    use user_index_canister::ChildCanisterType;

    pub fn current_user(
        env: &PocketIc,
        sender: Principal,
        canister_id: CanisterId,
    ) -> user_index_canister::current_user::SuccessResult {
        let response = super::current_user(env, sender, canister_id, &user_index_canister::current_user::Args {});

        match response {
            user_index_canister::current_user::Response::Success(result) => result,
            response => panic!("'current_user' error: {response:?}"),
        }
    }

    pub fn set_username(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, username: String) {
        let response = super::set_username(
            env,
            sender,
            canister_id,
            &user_index_canister::set_username::Args { username },
        );

        if !matches!(response, user_index_canister::set_username::Response::Success) {
            panic!("'set_username' error: {response:?}")
        }
    }

    pub fn set_display_name(env: &mut PocketIc, sender: Principal, canister_id: CanisterId, display_name: Option<String>) {
        let response = super::set_display_name(
            env,
            sender,
            canister_id,
            &user_index_canister::set_display_name::Args { display_name },
        );

        if !matches!(response, user_index_canister::set_display_name::Response::Success) {
            panic!("'set_display_name' error: {response:?}")
        }
    }

    pub fn pay_for_diamond_membership(
        env: &mut PocketIc,
        sender: Principal,
        canister_id: CanisterId,
        duration: DiamondMembershipPlanDuration,
        pay_in_chat: bool,
        recurring: bool,
    ) -> user_index_canister::pay_for_diamond_membership::SuccessResult {
        let fees = DiamondMembershipFees::default();

        let response = super::pay_for_diamond_membership(
            env,
            sender,
            canister_id,
            &user_index_canister::pay_for_diamond_membership::Args {
                duration,
                token: if pay_in_chat { Cryptocurrency::CHAT } else { Cryptocurrency::InternetComputer },
                expected_price_e8s: if pay_in_chat { fees.chat_price_e8s(duration) } else { fees.icp_price_e8s(duration) },
                recurring,
            },
        );

        match response {
            user_index_canister::pay_for_diamond_membership::Response::Success(result) => result,
            response => panic!("'pay_for_diamond_membership' error: {response:?}"),
        }
    }

    pub fn user(env: &PocketIc, canister_id: CanisterId, user_id: UserId) -> UserSummary {
        let response = super::user(
            env,
            Principal::anonymous(),
            canister_id,
            &user_index_canister::user::Args {
                user_id: Some(user_id),
                username: None,
            },
        );

        match response {
            user_index_canister::user::Response::Success(result) => result,
            _ => panic!("User not found"),
        }
    }

    pub fn users(
        env: &PocketIc,
        sender: Principal,
        canister_id: CanisterId,
        users: Vec<UserId>,
    ) -> user_index_canister::users::Result {
        let user_index_canister::users::Response::Success(result) = super::users(
            env,
            sender,
            canister_id,
            &user_index_canister::users::Args {
                user_groups: vec![UserGroup { users, updated_since: 0 }],
                users_suspended_since: None,
            },
        );

        result
    }

    pub fn upgrade_local_user_index_canister_wasm(
        env: &mut PocketIc,
        sender: Principal,
        user_index_canister_id: CanisterId,
        wasm: CanisterWasm,
    ) {
        upload_wasm_in_chunks(
            env,
            sender,
            user_index_canister_id,
            &wasm.module,
            ChildCanisterType::LocalUserIndex,
        );

        let response = super::upgrade_local_user_index_canister_wasm(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::upgrade_local_user_index_canister_wasm::Args {
                version: wasm.version,
                wasm_hash: sha256(&wasm.module),
                filter: None,
            },
        );

        assert!(matches!(
            response,
            user_index_canister::upgrade_local_user_index_canister_wasm::Response::Success
        ));
    }

    pub fn upgrade_user_canister_wasm(
        env: &mut PocketIc,
        sender: Principal,
        user_index_canister_id: CanisterId,
        wasm: CanisterWasm,
    ) {
        upload_wasm_in_chunks(env, sender, user_index_canister_id, &wasm.module, ChildCanisterType::User);

        let response = super::upgrade_user_canister_wasm(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::upgrade_user_canister_wasm::Args {
                version: wasm.version,
                wasm_hash: sha256(&wasm.module),
                filter: None,
            },
        );

        assert!(matches!(
            response,
            user_index_canister::upgrade_user_canister_wasm::Response::Success
        ));
    }

    pub fn add_local_user_index_canister(
        env: &mut PocketIc,
        sender: Principal,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
    ) {
        let response = super::add_local_user_index_canister(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::add_local_user_index_canister::Args {
                canister_id: local_user_index_canister_id,
                notifications_canister_id,
            },
        );

        assert!(matches!(
            response,
            user_index_canister::add_local_user_index_canister::Response::Success
        ));
    }

    pub fn public_key(env: &mut PocketIc, user_index_canister_id: CanisterId) -> String {
        let response = super::public_key(env, Principal::anonymous(), user_index_canister_id, &Empty {});

        match response {
            user_index_canister::public_key::Response::Success(pk) => pk,
            response => panic!("'public_key' error: {response:?}"),
        }
    }

    pub fn add_platform_operator(env: &mut PocketIc, sender: Principal, user_index_canister_id: CanisterId, user_id: UserId) {
        let response = super::add_platform_operator(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::add_platform_operator::Args { user_id },
        );

        match response {
            user_index_canister::add_platform_operator::Response::Success => {}
        }
    }

    pub fn users_chit(
        env: &PocketIc,
        user_index_canister_id: CanisterId,
        users: Vec<UserId>,
        year: u16,
        month: u8,
    ) -> HashMap<UserId, Chit> {
        let response = super::users_chit(
            env,
            Principal::anonymous(),
            user_index_canister_id,
            &user_index_canister::users_chit::Args {
                users: users.clone(),
                year,
                month,
            },
        );

        match response {
            user_index_canister::users_chit::Response::Success(result) => users.into_iter().zip(result.chit).collect(),
        }
    }

    pub fn register_bot(
        env: &mut PocketIc,
        caller: Principal,
        user_index_canister_id: CanisterId,
        name: String,
        endpoint: String,
        definition: BotDefinition,
    ) -> (UserId, Principal) {
        let principal = random_principal();

        let response = super::register_bot(
            env,
            caller,
            user_index_canister_id,
            &user_index_canister::register_bot::Args {
                principal,
                name,
                avatar: None,
                endpoint,
                definition,
                permitted_install_location: None,
            },
        );

        match response {
            user_index_canister::register_bot::Response::Success(result) => (result.bot_id, principal),
            response => panic!("'register_bot' error: {response:?}"),
        }
    }

    pub fn publish_bot(env: &mut PocketIc, caller: Principal, user_index_canister_id: CanisterId, bot_id: UserId) {
        let response = super::publish_bot(
            env,
            caller,
            user_index_canister_id,
            &user_index_canister::publish_bot::Args { bot_id },
        );

        match response {
            user_index_canister::publish_bot::Response::Success => (),
            response => panic!("'publish_bot' error: {response:?}"),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_bot(
        env: &mut PocketIc,
        user_index_canister_id: CanisterId,
        caller: Principal,
        bot_id: UserId,
        bot_principal: Option<Principal>,
        owner: Option<UserId>,
        endpoint: Option<String>,
        definition: Option<BotDefinition>,
    ) {
        let response = super::update_bot(
            env,
            caller,
            user_index_canister_id,
            &user_index_canister::update_bot::Args {
                bot_id,
                owner,
                principal: bot_principal,
                avatar: OptionUpdate::NoChange,
                endpoint,
                definition,
            },
        );

        match response {
            user_index_canister::update_bot::Response::Success => (),
            response => panic!("'update_bot' expected Success: {response:?}"),
        }
    }

    pub fn remove_bot(env: &mut PocketIc, sender: Principal, user_index_canister_id: CanisterId, bot_id: UserId) {
        let response = super::remove_bot(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::remove_bot::Args { bot_id },
        );

        assert!(matches!(response, user_index_canister::remove_bot::Response::Success));
    }

    pub fn bot_updates(
        env: &PocketIc,
        sender: Principal,
        user_index_canister_id: CanisterId,
        updated_since: TimestampMillis,
    ) -> user_index_canister::bot_updates::SuccessResult {
        let response = super::bot_updates(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::bot_updates::Args { updated_since },
        );

        match response {
            user_index_canister::bot_updates::Response::Success(success_result) => success_result,
            response => panic!("'bot_updates' expected Success: {response:?}"),
        }
    }

    pub fn explore_bots(
        env: &PocketIc,
        sender: Principal,
        user_index_canister_id: CanisterId,
        search_term: Option<String>,
    ) -> user_index_canister::explore_bots::SuccessResult {
        let response = super::explore_bots(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::explore_bots::Args {
                installation_location: None,
                search_term,
                page_index: 0,
                page_size: 10,
            },
        );

        match response {
            user_index_canister::explore_bots::Response::Success(success_result) => success_result,
            response => panic!("'explore_bots' expected Success: {response:?}"),
        }
    }

    pub fn user_registration_canister(env: &PocketIc, user_index_canister_id: CanisterId) -> CanisterId {
        let response = super::user_registration_canister(env, Principal::anonymous(), user_index_canister_id, &Empty {});

        match response {
            user_index_canister::user_registration_canister::Response::Success(local_user_index) => local_user_index,
            response => panic!("'user_registration_canister' error: {response:?}"),
        }
    }

    fn upload_wasm_in_chunks(
        env: &mut PocketIc,
        sender: Principal,
        user_index_canister_id: CanisterId,
        wasm: &[u8],
        canister_type: ChildCanisterType,
    ) {
        for (index, chunk) in wasm.chunks(1_000_000).enumerate() {
            let response = super::upload_wasm_chunk(
                env,
                sender,
                user_index_canister_id,
                &user_index_canister::upload_wasm_chunk::Args {
                    canister_type,
                    chunk: chunk.to_vec().into(),
                    index: index as u8,
                },
            );
            assert!(matches!(
                response,
                user_index_canister::upload_wasm_chunk::Response::Success(_)
            ));
        }
    }
}
