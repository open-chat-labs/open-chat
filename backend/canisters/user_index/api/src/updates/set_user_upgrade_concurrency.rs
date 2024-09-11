use candid::CandidType;
use human_readable::HumanReadable;
use ts_export::ts_export;

#[ts_export(user_index, set_user_upgrade_concurrency)]
#[derive(CandidType, HumanReadable, Clone, Debug)]
pub struct Args {
    pub value: u32,
}

#[ts_export(user_index, set_user_upgrade_concurrency)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
}
