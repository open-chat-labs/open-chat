use crate::env::Environment;
use crate::model::data::Data;

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_consumer(&self) -> bool {
        self.data.consumer_principals.contains(&self.env.caller())
    }
}
