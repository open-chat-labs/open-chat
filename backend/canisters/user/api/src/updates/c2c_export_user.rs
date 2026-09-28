use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use types::{Hash, TimestampMillis};

// A page of the user as serialized when their migration started, starting at `from`. An empty page
// means there are no more.
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub page: ByteBuf,
    // The size of the whole serialized user, and the migration's hash, for the MultiUser canister to
    // check once it has pulled every page, along with when the migration started, which the hash
    // covers along with the user
    pub total_bytes: u64,
    pub hash: Hash,
    pub started: TimestampMillis,
}
