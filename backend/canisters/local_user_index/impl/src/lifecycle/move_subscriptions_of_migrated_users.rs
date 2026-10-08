use crate::Data;
use std::collections::BTreeSet;
use tracing::info;
use types::UserId;

// One-off: moves the subscriptions and FCM tokens still held under the old ids of users migrated to a
// MultiUser canister before this LocalUserIndex moved them on being told of each migration
// TODO remove after the release containing this has been deployed
pub(crate) fn move_subscriptions_of_migrated_users(data: &mut Data) {
    let user_ids: BTreeSet<UserId> = data
        .web_push_subscriptions
        .user_ids()
        .chain(data.fcm_token_store.iter().map(|(user_id, _)| *user_id))
        .collect();

    let mut moved = 0;
    for user_id in user_ids {
        if let Some(new_user_id) = data.migrated_user_ids.get(&user_id) {
            data.web_push_subscriptions.migrate_user_id(user_id, new_user_id);
            data.fcm_token_store.migrate_user_id(user_id, new_user_id);
            moved += 1;
        }
    }

    info!(moved, "Moved the subscriptions held under the old ids of migrated users");
}
