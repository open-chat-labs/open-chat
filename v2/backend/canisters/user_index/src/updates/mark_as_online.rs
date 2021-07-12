use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Args {}

#[update]
fn mark_as_online(_args: Args) {
    RUNTIME_STATE.with(|state| mark_as_online_impl(state.borrow_mut().as_mut().unwrap()))
}

fn mark_as_online_impl(runtime_state: &mut RuntimeState) {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();
    runtime_state.data.users.mark_online(caller, now);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::data::Data;
    use crate::model::user::{CreatedUser, User};
    use crate::test::env::TestEnv;
    use candid::Principal;
    use phonenumber::PhoneNumber;
    use std::str::FromStr;

    #[test]
    fn last_online_is_updated() {
        let mut env = TestEnv::default();
        let mut data = Data::default();
        data.users.add(User::Created(CreatedUser {
            principal: env.caller,
            phone_number: PhoneNumber::from_str("+44 1111 111 111").unwrap(),
            user_id: Principal::from_slice(&[1]).into(),
            username: "abc".to_string(),
            date_created: env.now,
            date_updated: env.now,
            last_online: env.now,
            ..Default::default()
        }));
        env.now += 10000;
        let mut runtime_state = RuntimeState::new(Box::new(env), data);

        mark_as_online_impl(&mut runtime_state);

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
