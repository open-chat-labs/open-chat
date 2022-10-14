use crate::{generate_query_call, generate_update_call};
use user_index_canister::*;

// Queries
generate_query_call!(check_username);
generate_query_call!(current_user);
generate_query_call!(search);
generate_query_call!(sms_messages);
generate_query_call!(super_admins);
generate_query_call!(user);
generate_query_call!(users);

// Updates
generate_update_call!(add_super_admin);
generate_update_call!(confirm_phone_number);
generate_update_call!(remove_sms_messages);
generate_update_call!(remove_super_admin);
generate_update_call!(register_user);
generate_update_call!(resend_code);
generate_update_call!(set_username);
generate_update_call!(submit_phone_number);
generate_update_call!(upgrade_user_canister_wasm);

pub mod happy_path {
    use crate::rng::random_principal;
    use crate::utils::principal_to_username;
    use crate::User;
    use ic_state_machine_tests::StateMachine;
    use types::{CanisterId, ChallengeAttempt};

    pub fn register_user(env: &mut StateMachine, canister_id: CanisterId) -> User {
        let principal = random_principal();

        let response = super::register_user(
            env,
            principal,
            canister_id,
            &user_index_canister::register_user::Args {
                username: principal_to_username(principal),
                challenge_attempt: ChallengeAttempt {
                    key: 0,
                    chars: "TEST".to_string(),
                },
                referred_by: None,
            },
        );

        match response {
            user_index_canister::register_user::Response::Success(user_id) => User { principal, user_id },
            response => panic!("'register_user' error: {:?}", response),
        }
    }
}
