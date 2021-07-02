use crate::model::runtime_state::RuntimeState;
use crate::model::user::User;
use serde::Deserialize;

pub fn update(runtime_state: &mut RuntimeState) {
    let user = runtime_state.data.users.get_by_principal(&runtime_state.env.caller());
    if let Some(User::Created(user)) = user {
        let now = runtime_state.env.now();
        let mut u2 = user.clone();
        u2.last_online = now;
        runtime_state.data.users.update(User::Created(u2));         
    }
}

#[derive(Deserialize)]
pub struct Request {
}
