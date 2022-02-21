use crate::Version;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct CanisterWasm {
    pub version: Version,
    pub compressed: bool,
    #[serde(with = "serde_bytes")]
    pub module: Vec<u8>,
}

impl Default for CanisterWasm {
    fn default() -> Self {
        CanisterWasm {
            version: Version::new(0, 0, 0),
            compressed: false,
            module: Vec::default(),
        }
    }
}

impl CanisterWasm {
    #[cfg(feature = "lzma-rs")]
    pub fn decompress(self) -> CanisterWasm {
        if !self.compressed {
            self
        } else {
            let mut decompressed = Vec::new();
            lzma_rs::xz_decompress(&mut self.module.as_ref(), &mut decompressed).unwrap();

            CanisterWasm {
                version: self.version,
                compressed: false,
                module: decompressed,
            }
        }
    }
}

impl Debug for CanisterWasm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CanisterWasm")
            .field("version", &self.version)
            .field("compressed", &self.compressed)
            .field("byte_length", &self.module.len())
            .finish()
    }
}
