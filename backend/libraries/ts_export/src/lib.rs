use serde::{Deserialize, Serialize};

pub use ts_export_macros::generate_ts_method;
pub use ts_export_macros::ts_export;

#[ts_export]
#[derive(Serialize, Deserialize)]
#[ts(type = "Uint8Array")]
pub struct TSBytes {}

pub fn is_default<T: Default + PartialEq>(t: &T) -> bool {
    *t == Default::default()
}
