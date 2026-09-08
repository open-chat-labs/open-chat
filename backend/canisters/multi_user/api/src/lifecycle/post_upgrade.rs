use serde::{Deserialize, Serialize};
use types::BuildVersion;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub wasm_version: BuildVersion,
}
