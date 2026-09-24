use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

// A page of the user as serialized when their migration started, `page_size` bytes starting at
// `from`. The caller must keep `page_size` within the limit on the size of a reply. An empty page
// means there are no more.
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: u64,
    pub page_size: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ByteBuf),
}
