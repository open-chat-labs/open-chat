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

    pub fn is_caller_sms_service(&self) -> bool {
        let caller = self.env.caller();

        self.data.sms_service_principals.contains(&caller)
    }
}
