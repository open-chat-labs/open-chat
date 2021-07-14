use crate::model::events::Events;
use candid::{CandidType, Principal};
use serde::Deserialize;
use std::collections::HashSet;

#[derive(CandidType, Deserialize)]
pub struct Data {
    pub consumer_principals: HashSet<Principal>,
    pub events: Events,
}

impl Data {
    pub fn new(consumer_principals: Vec<Principal>) -> Data {
        Data {
            consumer_principals: consumer_principals.into_iter().collect(),
            events: Events::default(),
        }
    }
}
