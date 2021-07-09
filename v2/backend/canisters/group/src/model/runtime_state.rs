use crate::env::Environment;
use crate::model::data::Data;
use crate::model::participant::Participant;

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn get_current_participant(&self) -> Option<&Participant> {
        self.data.participants.get_by_principal(&self.env.caller())
    }
}
