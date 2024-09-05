use candid::CandidType;
use ts_export::ts_export;

#[ts_export(notifications_index, subscription_exists)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub p256dh_key: String,
}

#[ts_export(notifications_index, subscription_exists)]
#[derive(CandidType, Debug)]
pub enum Response {
    Yes,
    No,
}
