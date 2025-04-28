use crate::generate_query_call;
use notifications_canister::*;

// Queries
generate_query_call!(latest_notification_index);
generate_query_call!(notifications_v2);

// Updates

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, Empty};

    pub fn notifications_v2(
        env: &PocketIc,
        sender: Principal,
        notifications_canister_id: CanisterId,
        from_index: u64,
    ) -> notifications_canister::notifications_v2::SuccessResult {
        let response = super::notifications_v2(
            env,
            sender,
            notifications_canister_id,
            &notifications_canister::notifications_v2::Args {
                from_notification_index: from_index,
            },
        );

        let notifications_canister::notifications_v2::Response::Success(result) = response;
        result
    }

    pub fn latest_notification_index(env: &PocketIc, sender: Principal, notifications_canister_id: CanisterId) -> u64 {
        let response = super::latest_notification_index(env, sender, notifications_canister_id, &Empty {});
        let notifications_canister::latest_notification_index::Response::Success(index) = response;
        index
    }
}
