use self::Response::*;
use crate::model::runtime_state::RuntimeState;
use crate::model::user_summary::UserSummary;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::UserId;

pub fn query(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let updated_since = args.updated_since;

    let users = args
        .users
        .iter()
        .filter_map(|user_id| runtime_state.data.users.get_by_user_id(&user_id))
        .filter_map(|u| u.created_user())
        .filter(|u| if let Some(updated_since) = updated_since { u.last_online > updated_since } else { true })
        .map(|u| UserSummary::new(&u, Some(now)))
        .collect();

    Success(Result { users, timestamp: now })
}

#[derive(Deserialize)]
pub struct Args {
    users: Vec<UserId>,
    updated_since: Option<TimestampMillis>,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    users: Vec<UserSummary>,
    timestamp: TimestampMillis,
}
