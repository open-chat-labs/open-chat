use std::cmp::Ordering;
use types::BuildVersion;

mod canisters_requiring_upgrade;
mod create;
mod delete;
mod deposit_cycles;
mod filtered_upgrades;
mod install;
mod pool;
mod raw_rand;
mod start;
mod stop;
mod update_settings;

pub use canisters_requiring_upgrade::*;
pub use create::*;
pub use delete::*;
pub use deposit_cycles::*;
pub use filtered_upgrades::*;
pub use install::*;
pub use pool::*;
pub use raw_rand::*;
pub use start::*;
pub use stop::*;
pub use update_settings::*;

pub fn should_perform_upgrade(current: BuildVersion, next: BuildVersion, test_mode: bool) -> bool {
    match current.cmp(&next) {
        Ordering::Less => true,
        Ordering::Greater if test_mode => true,
        _ => false,
    }
}
