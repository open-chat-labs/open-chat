use crate::model::runtime_state::RuntimeState;
use crate::model::user::User;
use crate::model::user_summary::UserSummary;
use candid::CandidType;
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
        return Response::Success(UserSummary::new(user, Some(now)));
    }

    Response::UserNotFound
}

#[derive(Deserialize)]
pub struct Request {
    user_id: Option<UserId>,
    username: Option<String>,
}

#[derive(CandidType)]
pub enum Response {
    UserNotFound,
    Success(UserSummary),
}
