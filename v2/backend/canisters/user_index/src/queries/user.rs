use candid::{CandidType};
use crate::model::runtime_state::RuntimeState;
use crate::model::user::User;
use serde::Deserialize;
use shared::types::UserId;

pub fn query(request: Request, runtime_state: &RuntimeState) -> Response {
    let mut user = None;
    if let Some(user_id) = request.user_id {
        user = runtime_state.data.users.get_by_user_id(&user_id);
    } else if let Some(username) = request.username {
        user = runtime_state.data.users.get_by_username(&username);
    }

    if let Some(User::Created(user)) = user {
        let now = runtime_state.env.now();
        let last_online = user.last_online;
        let seconds_since_last_online = ((now - last_online) / 1000) as u32;
        return Response::Success(UserSummary {
            user_id: user.user_id,
            username: user.username.clone(),
            seconds_since_last_online,          
        });
    }

    Response::UserNotFound
}

#[derive(Deserialize)]
pub struct Request {
    user_id: Option<UserId>,
    username: Option<String>,
}

#[derive(CandidType)]
pub struct UserSummary {
    user_id: UserId,
    username: String,
    seconds_since_last_online: u32,
}

#[derive(CandidType)]
pub enum Response {
    UserNotFound,
    Success(UserSummary),
}
