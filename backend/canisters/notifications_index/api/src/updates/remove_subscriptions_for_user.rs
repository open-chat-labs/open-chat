use candid::CandidType;
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(notifications_index, remove_subscriptions_for_user)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
}
