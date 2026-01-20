use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
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
