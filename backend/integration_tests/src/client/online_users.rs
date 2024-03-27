use crate::{generate_query_call, generate_update_call};
use online_users_canister::*;

// Queries
generate_query_call!(last_online);

// Updates
generate_update_call!(mark_as_online);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, Empty};

    pub fn mark_as_online(env: &mut PocketIc, sender: Principal, online_users_canister_id: CanisterId) {
        let response = super::mark_as_online(env, sender, online_users_canister_id, &Empty {});

        assert!(matches!(response, online_users_canister::mark_as_online::Response::Success));
    }
}
