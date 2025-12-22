use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
pub struct Salt {
    salt: [u8; 32],
}

impl Salt {
    pub fn new(salt: [u8; 32]) -> Self {
        assert_ne!(salt, [0; 32]);
        Self { salt }
    }

    pub fn get(&self) -> [u8; 32] {
        self.salt
    }
}
