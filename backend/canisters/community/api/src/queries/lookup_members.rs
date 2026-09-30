use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, UserId};

#[ts_export(community, lookup_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    // At most 1000
    pub user_ids: Vec<UserId>,
}

#[ts_export(community, lookup_members)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, lookup_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub members: Vec<CommunityMember>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // `Args` as they were before `invite_code` was added
    #[derive(Serialize)]
    struct PreviousArgs {
        user_ids: Vec<UserId>,
    }

    #[test]
    fn args_without_invite_code_are_read() {
        let bytes = msgpack::serialize_then_unwrap(PreviousArgs { user_ids: Vec::new() });
        let args: Args = msgpack::deserialize_then_unwrap(&bytes);
        assert!(args.invite_code.is_none());
    }
}
