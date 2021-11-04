use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::mark_as_online::{Response::*, *};

#[update]
#[trace]
fn mark_as_online(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| mark_as_online_impl(state.borrow_mut().as_mut().unwrap()))
}

fn mark_as_online_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();
    if runtime_state.data.users.mark_online(caller, now) {
        Success
    } else {
        UserNotFound
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{CreatedUser, User};
    use crate::Data;
    use candid::Principal;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn last_online_is_updated() {
        let mut env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: env.caller,
            phone_number: PhoneNumber::new(44, "1111 111 111".to_owned()),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
        }));
        env.now += 10000;
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        let response = mark_as_online_impl(&mut runtime_state);
        assert!(matches!(response, Success));

        let user = runtime_state
            .data
            .users
            .get_by_principal(&runtime_state.env.caller())
            .unwrap();

        if let User::Created(u) = user {
            assert_eq!(u.last_online, runtime_state.env.now());
        } else {
            panic!();
        }
    }
}
