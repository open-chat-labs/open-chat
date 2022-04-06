mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

pub const MIN_GROUP_NAME_LENGTH: u32 = 4;
pub const MAX_GROUP_NAME_LENGTH: u32 = 25;
pub const MAX_GROUP_DESCRIPTION_LENGTH: u32 = 1024;
