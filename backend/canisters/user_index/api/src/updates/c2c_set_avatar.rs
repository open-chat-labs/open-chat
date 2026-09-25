use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub avatar_id: Option<u128>,
    // The user whose avatar this is when the caller holds many users, which must be one of its users
    #[serde(default)]
    pub user_id: Option<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
    Error(OCError),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_from_the_previous_args() {
        #[derive(Serialize)]
        struct PreviousArgs {
            avatar_id: Option<u128>,
        }

        let args: Args = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(PreviousArgs { avatar_id: Some(1) }));
        assert_eq!(args.avatar_id, Some(1));
        assert!(args.user_id.is_none());
    }
}
