use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use user_index_canister::updates::mark_as_online::Args;

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
    use crate::Data;
    use candid::Principal;
    use phonenumber::PhoneNumber;
    use shared::env::test::TestEnv;
    use shared::types::Version;
    use std::str::FromStr;
    use user_index_canister::common::user::{CreatedUser, User};

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
            upgrade_in_progress: false,
            wasm_version: Version::new(0, 0, 0),
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
