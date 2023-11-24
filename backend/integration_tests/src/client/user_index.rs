use crate::{generate_query_call, generate_update_call};
use user_index_canister::*;

// Queries
generate_query_call!(check_username);
generate_query_call!(current_user);
generate_query_call!(search);
generate_query_call!(platform_moderators);
generate_query_call!(platform_moderators_group);
generate_query_call!(user);
generate_query_call!(users_v2);

// Updates
generate_update_call!(add_local_user_index_canister);
generate_update_call!(add_platform_moderator);
generate_update_call!(assign_platform_moderators_group);
generate_update_call!(c2c_register_bot);
generate_update_call!(pay_for_diamond_membership);
generate_update_call!(remove_platform_moderator);
generate_update_call!(set_display_name);
generate_update_call!(set_username);
generate_update_call!(suspend_user);
generate_update_call!(unsuspend_user);
generate_update_call!(upgrade_local_user_index_canister_wasm);
generate_update_call!(upgrade_user_canister_wasm);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{
        CanisterId, CanisterWasm, Cryptocurrency, DiamondMembershipDetails, DiamondMembershipPlanDuration, UserId, UserSummary,
    };
    use user_index_canister::users_v2::UserGroup;

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
        recurring: bool,
    ) -> DiamondMembershipDetails {
        let response = super::pay_for_diamond_membership(
            env,
            sender,
            canister_id,
            &user_index_canister::pay_for_diamond_membership::Args {
                duration,
                token: Cryptocurrency::InternetComputer,
                expected_price_e8s: duration.icp_price_e8s(),
                recurring,
            },
        );

        match response {
            user_index_canister::pay_for_diamond_membership::Response::Success(result) => result,
            response => panic!("'pay_for_diamond_membership' error: {response:?}"),
        }
    }

    pub fn users(env: &PocketIc, sender: Principal, canister_id: CanisterId, users: Vec<UserId>) -> Vec<UserSummary> {
        let user_index_canister::users_v2::Response::Success(result) = super::users_v2(
            env,
            sender,
            canister_id,
            &user_index_canister::users_v2::Args {
                user_groups: vec![UserGroup { users, updated_since: 0 }],
            },
        );

        result.users
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
}
