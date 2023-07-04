use bitflags::bitflags;
use serde::{Deserialize, Serialize};

bitflags! {
    #[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
    pub struct ModerationTags: u32 {
        const OFFENSIVE = 0b00000001;
        const ADULT     = 0b00000010;
    }
}
