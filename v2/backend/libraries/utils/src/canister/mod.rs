use types::Cycles;

mod create;
mod error;
mod pool;
mod upgrade;

pub use create::*;
pub use error::*;
pub use pool::*;
pub use upgrade::*;

pub fn get_approx_freeze_threshold() -> Cycles {
    0
}
