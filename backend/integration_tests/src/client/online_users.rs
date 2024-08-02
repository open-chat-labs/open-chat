use crate::{generate_query_call, generate_update_call};
use online_users_canister::*;

// Queries
generate_query_call!(last_online);

// Updates
generate_update_call!(mark_as_online);

pub mod happy_path {
    use candid::Principal;
    use online_users_canister::last_online::UserLastOnline;
    use pocket_ic::PocketIc;
    use types::{CanisterId, Empty, UserId};

    pub fn last_online(env: &mut PocketIc, user_ids: Vec<UserId>, online_users_canister_id: CanisterId) -> Vec<UserLastOnline> {
        let response = super::last_online(
            env,
            Principal::anonymous(),
            online_users_canister_id,
            &online_users_canister::last_online::Args { user_ids },
        );

        let online_users_canister::last_online::Response::Success(users) = response;
        users
    }

    pub fn mark_as_online(env: &mut PocketIc, sender: Principal, online_users_canister_id: CanisterId) {
        let response = super::mark_as_online(env, sender, online_users_canister_id, &Empty {});

        assert!(matches!(response, online_users_canister::mark_as_online::Response::Success));
    }
}
