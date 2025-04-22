use candid::{CandidType, Nat, define_function};
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
#[allow(non_camel_case_types)]
pub enum ContentStatus {
    approved,
    new,
    rejected,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
#[allow(non_snake_case)]
pub struct ViolatedRules {
    pub id: String,
    pub rejectionCount: Nat,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
#[allow(non_snake_case)]
pub struct ContentResult {
    pub approvedCount: Nat,
    pub rejectedCount: Nat,
    pub sourceId: String,
    pub status: ContentStatus,
    pub violatedRules: Vec<ViolatedRules>,
}

define_function!(pub SubscribeCallbackFunc : (ContentResult) -> () oneway);

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SubscribeMessage {
    pub callback: SubscribeCallbackFunc,
}

pub type Args = (SubscribeMessage,);
pub type Response = ();
