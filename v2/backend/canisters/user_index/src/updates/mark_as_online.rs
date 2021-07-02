use crate::model::runtime_state::RuntimeState;
use serde::Deserialize;

pub fn update(runtime_state: &mut RuntimeState) {
    let caller = &runtime_state.env.caller();
    let now = runtime_state.env.now();
    runtime_state.data.users.mark_online(caller, now);
}

#[derive(Deserialize)]
pub struct Request {}
