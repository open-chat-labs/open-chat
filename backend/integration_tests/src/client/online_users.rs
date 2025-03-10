use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use online_users_canister::*;

// Queries
generate_msgpack_query_call!(last_online);
generate_msgpack_query_call!(online_minutes);

// Updates
generate_msgpack_update_call!(mark_as_online);

pub mod happy_path {
    use candid::Principal;
    use online_users_canister::last_online::UserLastOnline;
    use pocket_ic::PocketIc;
    use types::{CanisterId, Empty, UserId};

    pub fn last_online(env: &PocketIc, user_ids: Vec<UserId>, online_users_canister_id: CanisterId) -> Vec<UserLastOnline> {
        let response = super::last_online(
            env,
            Principal::anonymous(),
            online_users_canister_id,
            &online_users_canister::last_online::Args { user_ids },
        );

        let online_users_canister::last_online::Response::Success(users) = response;
        users
    }

    pub fn online_minutes(
        env: &PocketIc,
        caller: Principal,
        online_users_canister_id: CanisterId,
        year: u32,
        month: u8,
    ) -> u32 {
        let response = super::online_minutes(
            env,
            caller,
            online_users_canister_id,
            &online_users_canister::online_minutes::Args { year, month },
        );

        let online_users_canister::online_minutes::Response::Success(minutes) = response;
        minutes
    }

    pub fn mark_as_online(env: &mut PocketIc, sender: Principal, online_users_canister_id: CanisterId) {
        let response = super::mark_as_online(env, sender, online_users_canister_id, &Empty {});

        assert!(matches!(response, online_users_canister::mark_as_online::Response::Success));
    }
}
