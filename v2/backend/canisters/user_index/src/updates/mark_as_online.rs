use crate::model::user::User;
use crate::model::runtime_state::RuntimeState;
use serde::Deserialize;

pub fn update(runtime_state: &mut RuntimeState) {
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
