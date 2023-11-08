use candid::{define_function, CandidType, Nat};
use serde::Deserialize;

pub type RuleId = String;

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
    pub id: RuleId,
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
