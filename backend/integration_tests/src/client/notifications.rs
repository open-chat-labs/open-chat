use crate::generate_query_call;
use notifications_canister::*;

// Queries
generate_query_call!(latest_notification_index);
generate_query_call!(notifications);

// Updates

pub mod happy_path {
    use candid::Principal;
    use notifications_canister::notifications::SuccessResult;
    use pocket_ic::PocketIc;
    use types::CanisterId;

    pub fn notifications(
        env: &PocketIc,
        sender: Principal,
        notifications_canister_id: CanisterId,
        from_index: u64,
    ) -> SuccessResult {
        let response = super::notifications(
            env,
            sender,
            notifications_canister_id,
            &notifications_canister::notifications::Args {
                from_notification_index: from_index,
            },
        );

        let notifications_canister::notifications::Response::Success(result) = response;
        result
    }
}
