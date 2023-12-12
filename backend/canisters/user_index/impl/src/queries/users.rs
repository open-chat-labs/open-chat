use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use std::collections::HashSet;
use user_index_canister::users_v2::{Response::*, *};

#[query]
fn users_v2(args: Args) -> Response {
    read_state(|state| users_impl(args, state))
}

fn users_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();

    let mut user_ids = HashSet::new();
    let mut users = Vec::new();

    for group in args.user_groups {
        let updated_since = group.updated_since;
        users.extend(
            group
                .users
                .into_iter()
                .filter_map(|u| state.data.users.get_by_user_id(&u))
                .filter(move |u| u.date_updated > updated_since)
                .filter(|u| user_ids.insert(u.user_id))
                .map(|u| u.to_summary(now)),
        );
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
                .map(|u| u.to_summary(now)),
        );
    }

    Success(Result { users, timestamp: now })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{PhoneStatus, User};
    use crate::Data;
    use candid::Principal;
    use itertools::Itertools;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn requested_users_returned() {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        data.users.add_test_user(User {
            principal: Principal::from_slice(&[1]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: user_id1,
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        env.now += 1000;
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[2]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "2222 222 222".to_owned())),
            user_id: user_id2,
            username: "def".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        env.now += 1000;
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[3]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "3333 333 333".to_owned())),
            user_id: user_id3,
            username: "ghi".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        env.now += 1000;
        let state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            user_groups: vec![UserGroup {
                users: vec![user_id1, user_id3],
                updated_since: 0,
            }],
            users_suspended_since: None,
        };

        let Success(result) = users_impl(args, &state);

        let users = result.users.iter().sorted_unstable_by_key(|u| u.user_id).collect_vec();

        assert_eq!(users.len(), 2);

        assert_eq!(users[0].user_id, user_id1);
        assert_eq!(users[0].username, "abc".to_string());

        assert_eq!(users[1].user_id, user_id3);
        assert_eq!(users[1].username, "ghi".to_string());
    }

    #[test]
    fn updated_since_filters_results() {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        data.users.add_test_user(User {
            principal: Principal::from_slice(&[1]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "1111 111 111".to_owned())),
            user_id: user_id1,
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        env.now += 1000;
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[2]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "2222 222 222".to_owned())),
            user_id: user_id2,
            username: "def".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        env.now += 1000;
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[3]),
            phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, "3333 333 333".to_owned())),
            user_id: user_id3,
            username: "ghi".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        env.now += 1000;
        let now = env.now;
        let state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            user_groups: vec![UserGroup {
                users: vec![user_id1, user_id3],
                updated_since: now - 1500,
            }],
            users_suspended_since: None,
        };

        let Success(result) = users_impl(args, &state);

        let users = result.users;

        assert_eq!(users.len(), 1);

        assert_eq!(users[0].user_id, user_id3);
        assert_eq!(users[0].username, "ghi".to_string());
    }
}
