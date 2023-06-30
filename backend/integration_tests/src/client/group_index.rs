use crate::{generate_query_call, generate_update_call};
use group_index_canister::*;

// Queries
generate_query_call!(explore_groups);
generate_query_call!(search);

// Updates
generate_update_call!(add_local_group_index_canister);
generate_update_call!(delete_frozen_group);
generate_update_call!(freeze_group);
generate_update_call!(unfreeze_group);

pub mod happy_path {
    use ic_test_state_machine_client::StateMachine;
    use types::{GroupMatch, CanisterId};

    use crate::User;

    pub fn explore_groups(env: &StateMachine, sender: &User, group_index_canister_id: CanisterId) -> Vec<GroupMatch> {
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
}