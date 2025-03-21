use ic_cdk::call::{Error, RejectCode};
use std::cmp::Ordering;
use types::{BuildVersion, CanisterId, UpgradesFilter};

mod canisters_requiring_upgrade;
mod chunk_store;
mod create;
mod delete;
mod deposit_cycles;
mod filtered_upgrades;
mod install;
mod pool;
mod raw_rand;
mod start;
mod stop;
mod uninstall;
mod update_settings;

pub use canisters_requiring_upgrade::*;
pub use chunk_store::*;
pub use create::*;
pub use delete::*;
pub use deposit_cycles::*;
pub use filtered_upgrades::*;
pub use install::*;
pub use pool::*;
pub use raw_rand::*;
pub use start::*;
pub use stop::*;
pub use uninstall::*;
pub use update_settings::*;

pub fn is_out_of_cycles_error(reject_code: RejectCode, message: &str) -> bool {
    matches!(reject_code, RejectCode::SysTransient) && message.contains("out of cycles")
}

pub fn should_retry_failed_c2c_call(reject_code: RejectCode, message: &str) -> bool {
    match reject_code {
        RejectCode::DestinationInvalid => false,
        RejectCode::CanisterReject => false,
        RejectCode::CanisterError if message.contains("IC0536") => false, // CanisterMethodNotFound
        RejectCode::CanisterError if message.contains("IC0537") => false, // CanisterWasmModuleNotFound
        _ => true,
    }
}

pub fn should_perform_upgrade(
    canister_id: CanisterId,
    current: BuildVersion,
    next: BuildVersion,
    filter: &UpgradesFilter,
    test_mode: bool,
) -> bool {
    match current.cmp(&next) {
        Ordering::Less => {}
        Ordering::Greater if test_mode => {}
        _ => return false,
    };

    if filter.exclude.contains(&canister_id) {
        false
    } else if filter.versions.is_empty() && filter.include.is_empty() {
        true
    } else {
        filter.versions.contains(&current) || filter.include.contains(&canister_id)
    }
}

pub fn convert_cdk_error(error: Error) -> (RejectCode, String) {
    match error {
        Error::InsufficientLiquidCycleBalance(cb) => (RejectCode::SysTransient, cb.to_string()),
        Error::CallPerformFailed(f) => (RejectCode::SysTransient, f.to_string()),
        Error::CallRejected(r) => (r.reject_code().unwrap_or(RejectCode::SysUnknown), r.to_string()),
        Error::CandidDecodeFailed(f) => (RejectCode::CanisterReject, f.to_string()),
    }
}
