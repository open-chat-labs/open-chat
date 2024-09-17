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
generate_msgpack_query_call!(users);
generate_msgpack_query_call!(users_chit);

// Updates
generate_update_call!(add_local_user_index_canister);
generate_update_call!(add_platform_moderator);
generate_update_call!(add_platform_operator);
generate_update_call!(assign_platform_moderators_group);
generate_update_call!(c2c_register_bot);
generate_msgpack_update_call!(delete_user);
generate_msgpack_update_call!(pay_for_diamond_membership);
generate_update_call!(remove_platform_moderator);
generate_msgpack_update_call!(set_display_name);
generate_msgpack_update_call!(set_username);
generate_msgpack_update_call!(suspend_user);
generate_msgpack_update_call!(update_diamond_membership_subscription);
generate_msgpack_update_call!(unsuspend_user);
generate_update_call!(upgrade_local_user_index_canister_wasm);
generate_update_call!(upgrade_user_canister_wasm);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use std::collections::HashMap;
    use types::{
        CanisterId, CanisterWasm, Chit, Cryptocurrency, DiamondMembershipFees, DiamondMembershipPlanDuration, Empty, UserId,
        UserSummary,
    };
    use user_index_canister::users::UserGroup;

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
        let response = super::upgrade_local_user_index_canister_wasm(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::upgrade_local_user_index_canister_wasm::Args {
                wasm,
                filter: None,
                use_for_new_canisters: None,
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
        let response = super::upgrade_user_canister_wasm(
            env,
            sender,
            user_index_canister_id,
            &user_index_canister::upgrade_user_canister_wasm::Args {
                wasm,
                filter: None,
                use_for_new_canisters: None,
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
}
