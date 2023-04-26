use crate::generate_update_call;
use local_user_index_canister::*;

// Queries

// Updates
generate_update_call!(join_group);
generate_update_call!(report_message);

pub mod happy_path {
    use candid::Principal;
    use ic_test_state_machine_client::StateMachine;
    use types::{CanisterId, ChatId};

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
