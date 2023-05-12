use crate::generate_update_call;
use local_user_index_canister::*;

// Queries

// Updates
generate_update_call!(join_group);
generate_update_call!(register_user);
generate_update_call!(report_message);

pub mod happy_path {
    use crate::rng::random_user_principal;
    use crate::utils::principal_to_username;
    use crate::User;
    use candid::Principal;
    use ic_test_state_machine_client::StateMachine;
    use types::{CanisterId, ChatId};

    pub fn register_user(env: &mut StateMachine, canister_id: CanisterId) -> User {
        register_user_with_referrer(env, canister_id, None)
    }

    pub fn register_user_with_referrer(env: &mut StateMachine, canister_id: CanisterId, referral_code: Option<String>) -> User {
        let (principal, public_key) = random_user_principal();

        let response = super::register_user(
            env,
            principal,
            canister_id,
            &local_user_index_canister::register_user::Args {
                username: principal_to_username(principal),
                referral_code,
                public_key,
            },
        );

        env.tick();

        match response {
            local_user_index_canister::register_user::Response::Success(res) => User {
                principal,
                user_id: res.user_id,
            },
            response => panic!("'register_user' error: {response:?}"),
        }
    }

    pub fn join_group(env: &mut StateMachine, sender: Principal, local_user_index_canister_id: CanisterId, chat_id: ChatId) {
        let response = super::join_group(
            env,
            sender,
            local_user_index_canister_id,
            &local_user_index_canister::join_group::Args {
                chat_id,
                invite_code: None,
                correlation_id: 0,
            },
        );

        match response {
            local_user_index_canister::join_group::Response::Success(_) => {}
            response => panic!("'join_group' error: {response:?}"),
        }
    }
}
