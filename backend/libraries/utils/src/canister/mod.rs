use ic_cdk::call::{Error, RejectCode};
use std::cmp::Ordering;
use types::{BuildVersion, C2CError, CanisterId, Milliseconds, UpgradesFilter};

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
use constants::MINUTE_IN_MS;
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

// Returns `Some(delay)` if the call should be retried, else `None`.
pub fn delay_if_should_retry_failed_c2c_call(reject_code: RejectCode, message: &str) -> Option<Milliseconds> {
    match reject_code {
        RejectCode::DestinationInvalid => None,
        RejectCode::CanisterReject => None,
        RejectCode::CanisterError if message.contains("IC0207") => Some(5 * MINUTE_IN_MS), // CanisterOutOfCycles
        RejectCode::CanisterError if message.contains("IC0502") => Some(5 * MINUTE_IN_MS), // CanisterTrapped
        RejectCode::CanisterError if message.contains("IC0503") => Some(5 * MINUTE_IN_MS), // CanisterCalledTrap
        RejectCode::CanisterError if message.contains("IC0536") => None,                   // CanisterMethodNotFound
        RejectCode::CanisterError if message.contains("IC0537") => None,                   // CanisterWasmModuleNotFound
        RejectCode::CanisterError if message.contains("IC0540") => None,                   // ReservedCyclesLimitIsTooLow
        RejectCode::SysTransient if message.contains("insufficient liquid cycles balance") => Some(5 * MINUTE_IN_MS),
        _ => Some(0),
    }
}

pub fn is_target_canister_uninstalled_or_deleted(reject_code: RejectCode, message: &str) -> bool {
    match reject_code {
        RejectCode::DestinationInvalid => true,
        RejectCode::CanisterError if message.contains("IC0537") => true,
        _ => false,
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

pub fn convert_cdk_error(canister_id: CanisterId, method_name: &'static str, error: Error) -> C2CError {
    let (code, msg) = match error {
        Error::InsufficientLiquidCycleBalance(cb) => (RejectCode::SysTransient, cb.to_string()),
        Error::CallPerformFailed(f) => (RejectCode::SysTransient, f.to_string()),
        Error::CallRejected(r) => (r.reject_code().unwrap_or(RejectCode::SysUnknown), r.to_string()),
        Error::CandidDecodeFailed(f) => (RejectCode::CanisterReject, f.to_string()),
    };

    C2CError::new(canister_id, method_name, code, msg)
}
