pub use ts_export_macros::generate_ts_method;
pub use ts_export_macros::ts_export;

#[ts_export]
#[ts(type = "Uint8Array")]
pub struct PrincipalTS {}
