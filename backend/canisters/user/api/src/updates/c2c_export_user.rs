use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

// A page of the user as serialized when their migration started, starting at `from`. An empty page
// means there are no more.
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ByteBuf),
}
