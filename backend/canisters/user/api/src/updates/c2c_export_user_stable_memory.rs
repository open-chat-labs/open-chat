use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};

// A page of the raw entries in the canister's stable memory map, in key order, starting after the
// key `after`
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub after: Option<ByteBuf>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize)]
pub struct SuccessResult {
    pub entries: Vec<(ByteBuf, ByteBuf)>,
    pub finished: bool,
}

impl Debug for SuccessResult {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let mut s = f.debug_struct("SuccessResult");
        s.field("entries", &self.entries.len());
        s.field("finished", &self.finished);
        s.finish()
    }
}
