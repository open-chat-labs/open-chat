use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::users::{Response::*, *};

#[query]
fn users(args: Args) -> Response {
    read_state(|state| users_impl(args, state))
}

fn users_impl(args: Args, state: &RuntimeState) -> Response {
    state.trap_if_caller_not_openchat_user();

    let now = state.env.now();

    let users = args
        .user_groups
        .into_iter()
        .flat_map(|g| {
            let updated_since = g.updated_since;
            g.users
                .into_iter()
                .filter_map(|user_id| state.data.users.get_by_user_id(&user_id))
                .filter(move |u| u.date_updated > updated_since)
                .map(|u| u.to_partial_summary(now))
        })
        .collect();

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
        };

        let Success(result) = users_impl(args, &state);

        let users = result.users.iter().sorted_unstable_by_key(|u| u.user_id).collect_vec();

        assert_eq!(users.len(), 2);

        assert_eq!(users[0].user_id, user_id1);
        assert_eq!(users[0].username, Some("abc".to_string()));

        assert_eq!(users[1].user_id, user_id3);
        assert_eq!(users[1].username, Some("ghi".to_string()));
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
        };

        let Success(result) = users_impl(args, &state);

        let users = result.users;

        assert_eq!(users.len(), 1);

        assert_eq!(users[0].user_id, user_id3);
        assert_eq!(users[0].username, Some("ghi".to_string()));
    }
}
