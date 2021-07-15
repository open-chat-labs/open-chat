use crate::model::data::Data;
use shared::env::Environment;

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_participant(&self) -> bool {
        self.data.participants.get_by_principal(&self.env.caller()).is_some()
    }
}
