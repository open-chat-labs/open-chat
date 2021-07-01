mod env;
mod install;
mod queries;
mod updates;

use crate::model::runtime_state::RuntimeState;
use std::cell::RefCell;

thread_local! {
    pub static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
}
