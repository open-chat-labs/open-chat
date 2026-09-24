use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use std::collections::{HashMap, HashSet};
use types::{CurrentUserSummary, UserId, UserSummaryV2};
use user_index_canister::users::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn users(args: Args) -> Response {
    read_state(|state| users_impl(args, state))
}

fn users_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();
    let caller = state.env.caller();

    let mut user_ids = HashSet::new();
    let mut users: Vec<UserSummaryV2> = Vec::new();
    let mut deleted = Vec::new();
    let mut current_user: Option<CurrentUserSummary> = None;
    // The index in `users` of each user returned, by their latest id
    let mut indexes: HashMap<UserId, usize> = HashMap::new();

    if let Some(u) = state.data.users.get_by_principal(&caller)
        && let Some((updated_since, known_by_earlier_id)) = args.user_groups.iter().find_map(|g| {
            g.users
                .iter()
                .find(|id| state.data.migrated_user_ids.latest(**id) == u.user_id)
                .map(|id| (g.updated_since, *id != u.user_id))
        })
        // A client which knows the caller by an earlier id gets them whether or not they've been
        // updated, so that it learns their latest id
        && (known_by_earlier_id || u.date_updated > updated_since || u.chit_updated > updated_since)
    {
        let suspension_details = u.suspension_details.as_ref().map(|d| d.into());

        current_user = Some(CurrentUserSummary {
            user_id: u.user_id,
            username: u.username.clone(),
            display_name: u.display_name.clone(),
            avatar_id: u.avatar_id,
            profile_background_id: u.profile_background_id,
            is_bot: u.user_type.is_bot(),
            is_platform_moderator: state.data.is_platform_moderator_active(&u.user_id),
            is_platform_operator: state.data.is_platform_operator_active(&u.user_id),
            suspension_details,
            is_suspected_bot: state.data.users.is_suspected_bot(&u.user_id),
            diamond_membership_details: u.diamond_membership_details.hydrate(now),
            diamond_membership_status: u.diamond_membership_details.status_full(now),
            moderation_flags_enabled: u.moderation_flags_enabled,
            is_unique_person: u.unique_person_proof.is_some(),
            total_chit_earned: u.total_chit_earned,
            chit_balance: u.chit_balance,
            streak: u.streak(now),
            max_streak: u.max_streak,
            hide_online_status: u.hide_online_status,
        });
    }

    for group in args.user_groups {
        let updated_since = group.updated_since;

        for user_id in group.users {
            if !user_ids.insert(user_id) {
                continue;
            }
            // A user migrated to a MultiUser canister since the client looked them up by this id is
            // returned under their latest id, along with this one, so the client can map one to the
            // other. Each user is returned once, along with every earlier id they were looked up by.
            let latest_user_id = state.data.migrated_user_ids.latest(user_id);
            let is_earlier_id = latest_user_id != user_id;
            if let Some(&index) = indexes.get(&latest_user_id) {
                if is_earlier_id {
                    users[index].previous_user_ids.push(user_id);
                }
                continue;
            }
            // If the client only has the user cached under an earlier id, it gets them in full,
            // whether or not they've been updated
            if let Some(user) = state.data.users.get_by_user_id(&latest_user_id).filter(|u| {
                (is_earlier_id
                    || u.date_updated > updated_since
                    || u.chit_updated > updated_since
                    || (now > u.streak_ends && u.streak_ends > updated_since))
                    && u.principal != caller
            }) {
                user_ids.insert(latest_user_id);
                indexes.insert(latest_user_id, users.len());
                users.push(UserSummaryV2 {
                    user_id: latest_user_id,
                    stable: (is_earlier_id || user.date_updated > updated_since).then(|| user.to_summary_stable(now)),
                    volatile: Some(user.to_summary_volatile(now)),
                    previous_user_ids: if is_earlier_id { vec![user_id] } else { Vec::new() },
                });
                // TODO maybe convert `deleted_users` to a HashMap?
            } else if state.data.users.is_deleted(&latest_user_id) {
                deleted.push(user_id)
            }
        }
    }

    if let Some(ts) = args.users_suspended_since {
        users.extend(
            state
                .data
                .users
                .iter_suspended_or_unsuspended_users(ts)
                .rev()
                .take(100)
                .filter(|u| user_ids.insert(*u))
                .filter_map(|u| state.data.users.get_by_user_id(&u))
                .map(|u| u.to_summary_v2(now)),
        );
    }

    Success(Result {
        users,
        current_user,
        deleted,
        timestamp: now,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::user::User;
    use candid::Principal;
    use types::TimestampMillis;
    use utils::env::test::TestEnv;

    #[test]
    fn migrated_user_returned_in_full_under_latest_id() {
        let state = setup_runtime_state();

        let result = users(&state, vec![user_id(1)], state.env.now());

        assert_eq!(result.users.len(), 1);
        let user = &result.users[0];
        assert_eq!(user.user_id, user_id(2));
        assert_eq!(user.previous_user_ids, vec![user_id(1)]);
        assert!(user.stable.is_some());
        assert!(user.volatile.is_some());
    }

    #[test]
    fn user_looked_up_by_latest_id_has_no_previous_ids() {
        let state = setup_runtime_state();

        let result = users(&state, vec![user_id(2)], 0);

        assert_eq!(result.users.len(), 1);
        assert_eq!(result.users[0].user_id, user_id(2));
        assert!(result.users[0].previous_user_ids.is_empty());
    }

    #[test]
    fn migrated_user_returned_once_whatever_the_order_of_ids() {
        let state = setup_runtime_state();

        for updated_since in [0, state.env.now()] {
            for user_ids in [vec![user_id(1), user_id(2)], vec![user_id(2), user_id(1)]] {
                let result = users(&state, user_ids, updated_since);

                assert_eq!(result.users.len(), 1);
                assert_eq!(result.users[0].user_id, user_id(2));
                assert_eq!(result.users[0].previous_user_ids, vec![user_id(1)]);
                assert!(result.users[0].stable.is_some());
            }
        }
    }

    #[test]
    fn user_migrated_more_than_once_returned_with_each_earlier_id() {
        let state = setup_runtime_state();

        let result = users(&state, vec![user_id(4), user_id(5)], 0);

        assert_eq!(result.users.len(), 1);
        assert_eq!(result.users[0].user_id, user_id(6));
        assert_eq!(result.users[0].previous_user_ids, vec![user_id(4), user_id(5)]);
    }

    #[test]
    fn deleted_migrated_user_returned_as_deleted_under_earlier_id() {
        let state = setup_runtime_state();

        let result = users(&state, vec![user_id(7)], 0);

        assert!(result.users.is_empty());
        assert_eq!(result.deleted, vec![user_id(7)]);
    }

    #[test]
    fn current_user_returned_when_looked_up_by_earlier_id() {
        let state = setup_runtime_state();

        // Even though the caller hasn't been updated since
        let result = users(&state, vec![user_id(9)], state.env.now());

        assert!(result.users.is_empty());
        assert_eq!(result.current_user.map(|u| u.user_id), Some(user_id(10)));
    }

    #[test]
    fn current_user_looked_up_by_latest_id_not_returned_unless_updated() {
        let state = setup_runtime_state();

        let result = users(&state, vec![user_id(10)], state.env.now());

        assert!(result.current_user.is_none());
    }

    #[test]
    fn user_not_migrated_is_unaffected() {
        let state = setup_runtime_state();

        let result = users(&state, vec![user_id(3)], 0);

        assert_eq!(result.users.len(), 1);
        assert_eq!(result.users[0].user_id, user_id(3));
        assert!(result.users[0].previous_user_ids.is_empty());
    }

    fn users(state: &RuntimeState, user_ids: Vec<UserId>, updated_since: TimestampMillis) -> Result {
        let Response::Success(result) = users_impl(
            Args {
                user_groups: vec![UserGroup {
                    users: user_ids,
                    updated_since,
                }],
                users_suspended_since: None,
            },
            state,
        );
        result
    }

    // User 1 has been migrated to user 2, user 4 to user 5 then to user 6, user 7 to user 8, who
    // has since been deleted, and user 9, the caller, to user 10. User 3 hasn't been migrated.
    fn setup_runtime_state() -> RuntimeState {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        for i in [2, 3, 6, 8, 10] {
            data.users.add_test_user(User {
                principal: if i == 10 { env.caller } else { Principal::from_slice(&[i, 1]) },
                user_id: user_id(i),
                username: format!("user{i}"),
                date_created: env.now,
                date_updated: env.now,
                ..Default::default()
            });
        }
        data.users.delete_user(user_id(8), env.now);
        for (old, new) in [(1, 2), (4, 5), (5, 6), (7, 8), (9, 10)] {
            data.migrated_user_ids.insert(user_id(old), user_id(new));
        }
        env.now += 1000;

        RuntimeState::new(Box::new(env), data)
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }
}
