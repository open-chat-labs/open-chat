use crate::{mutate_state, read_state};
use std::collections::BTreeSet;
use tracing::{error, info};
use types::UserId;
use user_index_canister::migrated_user_ids;

// The number of users looked up in each call to the UserIndex
const BATCH_SIZE: usize = 10_000;

// One-off: moves the subscriptions and FCM tokens still held under the old ids of users migrated to a
// MultiUser canister before the NotificationsIndex moved them on being told of each migration. The
// LocalUserIndexes move their own copies.
// TODO remove after the release containing this has been deployed
pub(crate) async fn move_subscriptions_of_migrated_users() {
    let (user_ids, user_index_canister_id) = read_state(|state| {
        let user_ids: BTreeSet<UserId> = state
            .data
            .subscriptions
            .iter()
            .map(|(user_id, _)| *user_id)
            .chain(state.data.fcm_token_store.iter().map(|(user_id, _)| *user_id))
            .collect();
        (Vec::from_iter(user_ids), state.data.user_index_canister_id)
    });

    let mut moved = 0;
    let mut failed_lookups = 0;
    for batch in user_ids.chunks(BATCH_SIZE) {
        let args = migrated_user_ids::Args {
            user_ids: batch.to_vec(),
        };
        match user_index_canister_c2c_client::migrated_user_ids(user_index_canister_id, &args).await {
            Ok(migrated_user_ids::Response::Success(migrated)) => {
                moved += migrated.len();
                mutate_state(|state| {
                    for (old_user_id, new_user_id) in migrated {
                        state.data.migrate_user_id(old_user_id, new_user_id);
                    }
                });
            }
            Err(error) => {
                failed_lookups += batch.len();
                error!(?error, "Failed to look up which users have been migrated");
            }
        }
    }

    info!(
        users = user_ids.len(),
        moved, failed_lookups, "Moved the subscriptions held under the old ids of migrated users"
    );
}
