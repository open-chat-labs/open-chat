use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

// A page of the user as serialized when their migration started, `page_size` bytes starting at `from`
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: u64,
    pub page_size: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ByteBuf),
}
