use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub oc_secret_key_der: Vec<u8>,
}

pub type Response = UnitResult;
