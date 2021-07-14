use crate::model::events::Events;
use candid::{CandidType, Principal};
use serde::Deserialize;
use std::collections::HashSet;

#[derive(CandidType, Deserialize)]
pub struct Data {
    pub push_service_principals: HashSet<Principal>,
    pub events: Events,
}

impl Data {
    pub fn new(push_service_principals: Vec<Principal>) -> Data {
        Data {
            push_service_principals: push_service_principals.into_iter().collect(),
            events: Events::default(),
        }
    }
}
