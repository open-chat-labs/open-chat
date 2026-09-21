use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Args {
    // The user being acted for when the caller holds many users, which must be one of its users
    #[serde(default)]
    pub user_id: Option<UserId>,
}

pub type Response = UnitResult;

#[cfg(test)]
mod tests {
    use super::*;
    use types::Empty;

    #[test]
    fn deserializes_from_the_previous_empty_args() {
        let args: Args = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(Empty {}));
        assert!(args.user_id.is_none());
    }
}
