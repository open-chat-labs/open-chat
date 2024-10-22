use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};
use types::EventContext;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub after: Option<EventContext>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize)]
pub struct SuccessResult {
    pub events: Vec<(EventContext, ByteBuf)>,
    pub finished: bool,
}

impl Debug for SuccessResult {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let mut s = f.debug_struct("SuccessResult");
        s.field("events", &self.events.iter().map(|(k, _)| k));
        s.field("finished", &self.finished);
        s.finish()
    }
}
