use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    // The user being acted for when the caller holds many users, which must be one of its users
    #[serde(default)]
    pub user_id: Option<UserId>,
}

pub type Response = UnitResult;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_from_the_previous_args() {
        #[derive(Serialize)]
        struct PreviousArgs {
            principal: Principal,
        }

        let principal = Principal::from_slice(&[1]);
        let args: Args = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(PreviousArgs { principal }));
        assert_eq!(args.principal, principal);
        assert!(args.user_id.is_none());
    }
}
