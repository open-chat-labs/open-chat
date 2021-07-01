use crate::canister::RUNTIME_STATE;
use crate::model::user::User;
use crate::model::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use serde::Deserialize;

#[update]
fn mark_as_online(_: Request) {
    RUNTIME_STATE.with(|state| {
        mark_as_online_impl(state.borrow_mut().as_mut().unwrap())
    })
}

fn mark_as_online_impl(runtime_state: &mut RuntimeState) {
    if let Some(user) = runtime_state.data.users.get_by_principal(&runtime_state.env.caller()) {
        if matches!(user, User::Created(_)) {
            let now = runtime_state.env.now();
            let mut user = user.clone();
            user.set_last_online(now);
            runtime_state.data.users.update(user);
        }
    }
}

#[derive(Deserialize)]
pub struct Request {
}
