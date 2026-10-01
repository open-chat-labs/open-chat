use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CommunityMember, TimestampMillis};

// Searches the members' display names in the community. Usernames, and the display names users
// set for themselves, are searched by the UserIndex's `search` instead.
#[ts_export(community, search_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub search_term: String,
    pub max_results: u8,
    // As for `lookup_members`
    pub latest_known_update: Option<TimestampMillis>,
}

#[ts_export(community, search_members)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, search_members)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Those whose display names start with the search term (ignoring case) come first, then those
    // whose display names contain it, each shortest first. In a community in which a great many
    // members have display names, the search can stop before it has looked at them all, in which
    // case these are the best matches among those it looked at.
    pub members: Vec<CommunityMember>,
}
