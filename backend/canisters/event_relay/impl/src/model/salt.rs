use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "[u8; 32]")]
pub struct Salt {
    salt: [u8; 32],
}

impl Salt {
    pub fn get(&self) -> [u8; 32] {
        assert!(self.is_initialized());
        self.salt
    }

    pub fn set(&mut self, salt: [u8; 32]) {
        assert!(!self.is_initialized());
        self.salt = salt;
    }

    pub fn is_initialized(&self) -> bool {
        self.salt != [0; 32]
    }
}

impl From<[u8; 32]> for Salt {
    fn from(value: [u8; 32]) -> Self {
        Salt { salt: value }
    }
}
