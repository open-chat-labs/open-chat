use ic_cdk::api::call::RejectionCode;
use std::cmp::Ordering;
use types::BuildVersion;

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

pub fn is_out_of_cycles_error(rejection_code: RejectionCode, message: &str) -> bool {
    matches!(rejection_code, RejectionCode::SysTransient) && message.contains("out of cycles")
}

pub fn should_retry_failed_c2c_call(rejection_code: RejectionCode, message: &str) -> bool {
    match rejection_code {
        RejectionCode::DestinationInvalid => false,
        RejectionCode::CanisterReject => false,
        RejectionCode::CanisterError if message.contains("IC0536") => false, // CanisterMethodNotFound
        RejectionCode::CanisterError if message.contains("IC0537") => false, // CanisterWasmModuleNotFound
        _ => true,
    }
}

pub fn should_perform_upgrade(current: BuildVersion, next: BuildVersion, test_mode: bool) -> bool {
    match current.cmp(&next) {
        Ordering::Less => true,
        Ordering::Greater if test_mode => true,
        _ => false,
    }
}
