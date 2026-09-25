use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::UserSummary;
use user_index_canister::user::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn user(args: Args) -> Response {
    read_state(|state| user_impl(args, state))
}

fn user_impl(args: Args, state: &RuntimeState) -> Response {
    let mut user = None;
    let mut previous_user_ids = Vec::new();
    if let Some(user_id) = args.user_id {
        // A user migrated to a MultiUser canister is returned under their latest id
        let latest_user_id = state.data.migrated_user_ids.latest(user_id);
        user = state.data.users.get_by_user_id(&latest_user_id);
        if latest_user_id != user_id {
            previous_user_ids.push(user_id);
        }
    } else if let Some(username) = args.username {
        user = state.data.users.get_by_username(&username);
    }

    if let Some(user) = user {
        let now = state.env.now();
        Success(UserSummary {
            previous_user_ids,
            ..user.to_summary(now)
        })
    } else {
        UserNotFound
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::user::User;
    use candid::Principal;
    use types::UserId;
    use utils::env::test::TestEnv;

    #[test]
    fn migrated_user_returned_under_latest_id() {
        let state = setup_runtime_state();

        let user = user(&state, Some(user_id(1)), None);

        assert_eq!(user.user_id, user_id(2));
        assert_eq!(user.previous_user_ids, vec![user_id(1)]);
    }

    #[test]
    fn user_looked_up_by_latest_id_or_username_has_no_previous_id() {
        let state = setup_runtime_state();

        for user in [
            user(&state, Some(user_id(2)), None),
            user(&state, None, Some("user2".to_string())),
        ] {
            assert_eq!(user.user_id, user_id(2));
            assert!(user.previous_user_ids.is_empty());
        }
    }

    fn user(state: &RuntimeState, user_id: Option<UserId>, username: Option<String>) -> UserSummary {
        match user_impl(Args { user_id, username }, state) {
            Success(user) => user,
            response => panic!("{response:?}"),
        }
    }

    // User 1 has been migrated to user 2
    fn setup_runtime_state() -> RuntimeState {
        let env = TestEnv::default();
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[2, 1]),
            user_id: user_id(2),
            username: "user2".to_string(),
            date_created: env.now,
            date_updated: env.now,
            ..Default::default()
        });
        data.migrated_user_ids.insert(user_id(1), user_id(2));

        RuntimeState::new(Box::new(env), data)
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }
}
