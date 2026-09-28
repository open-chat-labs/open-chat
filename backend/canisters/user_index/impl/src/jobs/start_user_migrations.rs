use crate::RuntimeState;
use local_user_index_canister::{StartUserMigration, UserIndexEvent};
use tracing::info;
use types::{UserId, UserType};

// Takes users from the migration queue while fewer than the maximum are being migrated, assigning
// each a MultiUser canister and telling the LocalUserIndex controlling their canister to start
// migrating them. Nothing here is async, so rather than running on a timer, this is run whenever
// users are queued or a migration may have finished.
pub(crate) fn run(state: &mut RuntimeState) {
    while let Some(user) = state.data.user_migrations.try_take_next() {
        let user_id = user.user_id;
        if !can_migrate(&user_id, state) {
            // The user can no longer be migrated, eg. because they've since been deleted
            info!(%user_id, "User dropped from migration queue");
            continue;
        }
        let Some(multi_user_canister_id) = user.multi_user_canister_id.or_else(|| {
            let in_progress = state.data.user_migrations.in_progress_per_canister();
            state.data.multi_user_canisters.canister_for_migrating_user(&in_progress)
        }) else {
            // This is run again once a MultiUser canister is created
            state.data.user_migrations.return_to_front(user);
            break;
        };

        let now = state.env.now();
        state
            .data
            .user_migrations
            .mark_requested(user_id, multi_user_canister_id, now);
        state.push_event_to_local_user_index(
            user_id,
            UserIndexEvent::StartUserMigration(StartUserMigration {
                user_id,
                multi_user_canister_id,
            }),
        );
        info!(%user_id, %multi_user_canister_id, "User migration requested");
    }
}

// Users can be migrated if they are held in a canister of their own. Suspended users are migrated
// too, since their suspension is part of the user's state which is carried over.
pub(crate) fn can_migrate(user_id: &UserId, state: &RuntimeState) -> bool {
    user_id.is_canister()
        && state
            .data
            .users
            .get_by_user_id(user_id)
            .is_some_and(|user| user.user_type == UserType::User)
        && state.data.local_index_map.get_index_canister(user_id).is_some()
}
