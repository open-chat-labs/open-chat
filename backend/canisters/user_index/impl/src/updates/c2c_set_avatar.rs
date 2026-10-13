use crate::guards::caller_is_multi_user_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::c2c_set_avatar::{Response::*, *};

#[update(guard = "caller_is_multi_user_canister", msgpack = true)]
#[trace]
fn c2c_set_avatar(args: Args) -> Response {
    mutate_state(|state| c2c_set_avatar_impl(args, state))
}

fn c2c_set_avatar_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = args.user_id;
    if user_id.canister_id() != caller {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }
    let now = state.env.now();

    match state.data.users.set_avatar_id(&user_id, args.avatar_id, now) {
        true => Success,
        false => UserNotFound,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::user::User;
    use candid::Principal;
    use types::{CanisterId, UserId};
    use utils::env::test::TestEnv;

    fn canister_id(n: u8) -> CanisterId {
        Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, n, 1, 1])
    }

    // A user in each of two MultiUser canisters
    fn setup() -> (Data, UserId, UserId) {
        let multi_user_user = UserId::new_indexed(canister_id(2), 1);
        let other_multi_user_user = UserId::new_indexed(canister_id(3), 1);

        let mut data = Data::default();
        for (i, user_id) in [multi_user_user, other_multi_user_user].into_iter().enumerate() {
            data.users.add_test_user(User {
                principal: Principal::from_slice(&[i as u8 + 10; 29]),
                user_id,
                username: format!("user{i}"),
                ..Default::default()
            });
        }
        (data, multi_user_user, other_multi_user_user)
    }

    fn call(data: Data, caller: CanisterId, user_id: UserId) -> (Response, RuntimeState) {
        let env = TestEnv {
            caller,
            ..Default::default()
        };
        let mut state = RuntimeState::new(Box::new(env), data);
        let response = c2c_set_avatar_impl(
            Args {
                avatar_id: Some(5),
                user_id,
            },
            &mut state,
        );
        (response, state)
    }

    fn avatar_id(state: &RuntimeState, user_id: UserId) -> Option<u128> {
        state.data.users.get_by_user_id(&user_id).unwrap().avatar_id
    }

    #[test]
    fn a_multi_user_canister_sets_the_avatar_of_a_user_it_holds() {
        let (data, user, other_user) = setup();
        let (response, state) = call(data, user.canister_id(), user);
        assert!(matches!(response, Success));
        assert_eq!(avatar_id(&state, user), Some(5));
        assert_eq!(avatar_id(&state, other_user), None);
    }

    #[test]
    fn no_other_canister_can_set_a_users_avatar() {
        let (data, user, other_user) = setup();
        let (response, state) = call(data, other_user.canister_id(), user);
        assert!(
            matches!(&response, Error(e) if e.matches_code(OCErrorCode::InitiatorNotAuthorized)),
            "{response:?}"
        );
        assert_eq!(avatar_id(&state, user), None);
    }
}
