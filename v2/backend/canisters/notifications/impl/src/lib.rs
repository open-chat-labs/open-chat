use crate::model::subscriptions::Subscriptions;
use candid::{CandidType, Principal};
use serde::Deserialize;
use shared::env::Environment;
use shared::event_stream::EventStream;
use shared::types::notifications::Notification;
use std::cell::RefCell;
use std::collections::HashSet;

mod lifecycle;
mod model;
mod queries;
mod updates;

thread_local! {
    pub static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
}

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_push_service(&self) -> bool {
        self.data.push_service_principals.contains(&self.env.caller())
    }
}

#[derive(CandidType, Deserialize)]
pub struct Data {
    pub push_service_principals: HashSet<Principal>,
    pub notifications: EventStream<Notification>,
    pub subscriptions: Subscriptions,
}

impl Data {
    pub fn new(push_service_principals: Vec<Principal>) -> Data {
        Data {
            push_service_principals: push_service_principals.into_iter().collect(),
            notifications: EventStream::default(),
            subscriptions: Subscriptions::default(),
        }
    }
}
