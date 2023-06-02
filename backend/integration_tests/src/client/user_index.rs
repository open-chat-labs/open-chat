use crate::{generate_query_call, generate_update_call};
use user_index_canister::*;

// Queries
generate_query_call!(check_username);
generate_query_call!(current_user);
generate_query_call!(search);
generate_query_call!(platform_moderators);
generate_query_call!(platform_moderators_group);
generate_query_call!(user);
generate_query_call!(users);

// Updates
generate_update_call!(add_local_user_index_canister);
generate_update_call!(add_platform_moderator);
generate_update_call!(assign_platform_moderators_group);
generate_update_call!(c2c_register_bot);
generate_update_call!(pay_for_diamond_membership);
generate_update_call!(remove_platform_moderator);
generate_update_call!(set_username);
generate_update_call!(suspend_user);
generate_update_call!(unsuspend_user);
generate_update_call!(upgrade_user_canister_wasm);

pub mod happy_path {
    use candid::Principal;
    use ic_test_state_machine_client::StateMachine;
    use types::{CanisterId, Cryptocurrency, DiamondMembershipDetails, DiamondMembershipPlanDuration};

    pub fn current_user(
        env: &StateMachine,
        sender: Principal,
        canister_id: CanisterId,
    ) -> user_index_canister::current_user::SuccessResult {
        let response = super::current_user(env, sender, canister_id, &user_index_canister::current_user::Args {});

        match response {
            user_index_canister::current_user::Response::Success(result) => result,
            response => panic!("'current_user' error: {response:?}"),
        }
    }

    pub fn pay_for_diamond_membership(
        env: &mut StateMachine,
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
}
