use crate::{generate_msgpack_query_call, generate_msgpack_update_call, generate_update_call};
use notifications_index_canister::*;

// Queries
generate_msgpack_query_call!(notification_canisters);
generate_msgpack_query_call!(subscription_exists);

// Updates
generate_update_call!(notify_local_index_added);
generate_msgpack_update_call!(push_subscription);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{CanisterId, SubscriptionInfo, SubscriptionKeys};

    pub fn push_subscription(
        env: &mut PocketIc,
        sender: Principal,
        notifications_index_canister_id: CanisterId,
        auth: impl Into<String>,
        p256dh: impl Into<String>,
        endpoint: impl Into<String>,
    ) {
        let response = super::push_subscription(
            env,
            sender,
            notifications_index_canister_id,
            &notifications_index_canister::push_subscription::Args {
                subscription: SubscriptionInfo {
                    keys: SubscriptionKeys {
                        auth: auth.into(),
                        p256dh: p256dh.into(),
                    },
                    endpoint: endpoint.into(),
                },
            },
        );

        assert!(matches!(
            response,
            notifications_index_canister::push_subscription::Response::Success
        ));
    }

    pub fn subscription_exists(
        env: &PocketIc,
        sender: Principal,
        notifications_index_canister_id: CanisterId,
        p256dh_key: impl Into<String>,
    ) -> bool {
        let response = super::subscription_exists(
            env,
            sender,
            notifications_index_canister_id,
            &notifications_index_canister::subscription_exists::Args {
                p256dh_key: p256dh_key.into(),
            },
        );

        matches!(response, notifications_index_canister::subscription_exists::Response::Yes)
    }
}
