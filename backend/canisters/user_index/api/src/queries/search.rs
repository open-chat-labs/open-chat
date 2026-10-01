use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{TimestampMillis, UserSummary};

#[ts_export(user_index, search)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
    // Which page of `max_results` results to return, starting from 0. Lets a caller looking for
    // particular users, eg. the members of a chat, look further than the first page. Pages from
    // the 9th on are empty.
    pub page_index: Option<u32>,
}

#[ts_export(user_index, search)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[ts_export(user_index, search)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<UserSummary>,
    pub timestamp: TimestampMillis,
}

#[cfg(test)]
mod tests {
    use super::*;

    // `Args` as they were before `page_index` was added
    #[derive(Serialize)]
    struct PreviousArgs {
        search_term: String,
        max_results: u8,
    }

    #[test]
    fn args_without_page_index_are_read() {
        let bytes = msgpack::serialize_then_unwrap(PreviousArgs {
            search_term: "a".to_string(),
            max_results: 10,
        });
        let args: Args = msgpack::deserialize_then_unwrap(&bytes);
        assert!(args.page_index.is_none());
    }
}
