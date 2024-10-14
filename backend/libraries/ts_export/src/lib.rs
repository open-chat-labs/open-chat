use serde::{Deserialize, Serialize};

pub use ts_export_macros::generate_ts_method;
pub use ts_export_macros::ts_export;

#[ts_export]
#[derive(Serialize, Deserialize)]
#[ts(type = "Uint8Array")]
pub struct TSBytes {}

#[ts_export]
#[doc = " @default 0"]
#[derive(Serialize, Deserialize)]
#[ts(type = "number")]
pub struct TSNumberWithDefault {}

// We set the default to 'BigIntZero' rather than `BigInt(0)`, because using `BigInt(0)` results
// in a JSON error: "TypeError: Do not know how to serialize a BigInt".
// We then replace `BigIntZero` with `BigInt(0)` once the Typebox types have been generated.
#[ts_export]
#[doc = " @default BigIntZero"]
#[derive(Serialize, Deserialize)]
#[ts(type = "bigint")]
pub struct TSBigIntWithDefault {}

#[ts_export]
#[doc = " @default false"]
#[derive(Serialize, Deserialize)]
#[ts(type = "boolean")]
pub struct TSBoolWithDefault {}

pub fn is_default<T: Default + PartialEq>(t: &T) -> bool {
    *t == Default::default()
}
