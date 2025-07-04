use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use ts_export::ts_export;
use types::{MessageMatch, UserId};

#[ts_export(group, search_messages)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub search_term: String,
    pub max_results: u8,
    pub users: Option<HashSet<UserId>>,
}

#[ts_export(group, search_messages)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, search_messages)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub matches: Vec<MessageMatch>,
}
