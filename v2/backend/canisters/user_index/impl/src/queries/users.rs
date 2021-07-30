use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_index_canister::common::user_summary::PartialUserSummary;
use user_index_canister::queries::users::{Response::*, *};

#[query]
fn users(args: Args) -> Response {
    RUNTIME_STATE.with(|state| users_impl(args, state.borrow().as_ref().unwrap()))
}

fn users_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let updated_since = args.updated_since.unwrap_or(0);

    let users = args
        .users
        .iter()
        .filter_map(|user_id| runtime_state.data.users.get_by_user_id(user_id))
        .filter_map(|u| u.created_user())
        .filter(|u| u.date_updated > updated_since || u.last_online > updated_since)
        .map(|u| PartialUserSummary::new(u, u.date_updated > updated_since, now))
        .collect();

    Success(Result { users, timestamp: now })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use candid::Principal;
    use itertools::Itertools;
    use phonenumber::PhoneNumber;
    use shared::env::test::TestEnv;
    use shared::types::Version;
    use std::str::FromStr;
    use user_index_canister::common::user::{CreatedUser, User};

    #[test]
    fn requested_users_returned() {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[1]),
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: user_id1,
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[2]),
            phone_number: PhoneNumber::from_str("+44 2222 222 222").unwrap(),
            user_id: user_id2,
            username: "def".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[3]),
            phone_number: PhoneNumber::from_str("+44 3333 333 333").unwrap(),
            user_id: user_id3,
            username: "ghi".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        let runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            users: vec![user_id1, user_id3],
            updated_since: None,
        };

        let Success(result) = users_impl(args, &runtime_state);

        let users = result.users.iter().sorted_unstable_by_key(|u| u.user_id()).collect_vec();

        assert_eq!(users.len(), 2);

        assert_eq!(users[0].user_id(), user_id1);
        assert_eq!(users[0].username(), Some("abc".to_string()));
        assert_eq!(users[0].seconds_since_last_online(), 3);

        assert_eq!(users[1].user_id(), user_id3);
        assert_eq!(users[1].username(), Some("ghi".to_string()));
        assert_eq!(users[1].seconds_since_last_online(), 1);
    }

    #[test]
    fn updated_since_filters_results() {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[1]),
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: user_id1,
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[2]),
            phone_number: PhoneNumber::from_str("+44 2222 222 222").unwrap(),
            user_id: user_id2,
            username: "def".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[3]),
            phone_number: PhoneNumber::from_str("+44 3333 333 333").unwrap(),
            user_id: user_id3,
            username: "ghi".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        let now = env.now;
        let runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            users: vec![user_id1, user_id3],
            updated_since: Some(now - 1500),
        };

        let Success(result) = users_impl(args, &runtime_state);

        let users = result.users;

        assert_eq!(users.len(), 1);

        assert_eq!(users[0].user_id(), user_id3);
        assert_eq!(users[0].username(), Some("ghi".to_string()));
        assert_eq!(users[0].seconds_since_last_online(), 1);
    }

    #[test]
    fn username_skipped_if_not_updated_since_filter_date() {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        let start = env.now;
        env.now += 10000;

        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[1]),
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: user_id1,
            username: "abc".to_string(),
            date_created: start,
            date_updated: start,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[2]),
            phone_number: PhoneNumber::from_str("+44 2222 222 222").unwrap(),
            user_id: user_id2,
            username: "def".to_string(),
            date_created: start,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        data.users.add(User::Created(CreatedUser {
            principal: Principal::from_slice(&[3]),
            phone_number: PhoneNumber::from_str("+44 3333 333 333").unwrap(),
            user_id: user_id3,
            username: "ghi".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
        }));
        env.now += 1000;
        let runtime_state = RuntimeState::new(Box::new(env), data);

        let args = Args {
            users: vec![user_id1, user_id2, user_id3],
            updated_since: Some(start),
        };

        let Success(result) = users_impl(args, &runtime_state);

        let users = result.users.iter().sorted_unstable_by_key(|u| u.user_id()).collect_vec();

        assert_eq!(users.len(), 3);

        assert_eq!(users[0].username(), None);
        assert_eq!(users[1].username(), Some("def".to_string()));
        assert_eq!(users[2].username(), Some("ghi".to_string()));
    }
}
