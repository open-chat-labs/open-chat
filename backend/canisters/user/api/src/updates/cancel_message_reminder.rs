use candid::CandidType;
use ts_export::ts_export;

#[ts_export(user, cancel_message_reminder)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub reminder_id: u64,
}

#[ts_export(user, cancel_message_reminder)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
}
