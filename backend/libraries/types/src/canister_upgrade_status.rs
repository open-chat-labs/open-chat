use candid::CandidType;
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanisterUpgradeStatus {
    InProgress,
    NotRequired,
}
