mod lifecycle;
mod queries;
mod updates;

use candid::Principal;
pub use lifecycle::*;
pub use queries::*;
use types::UserId;
pub use updates::*;

// zzyk3-openc-hatbo-tq7my-cai
pub const OPENCHAT_BOT_PRINCIPAL: Principal = Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]);
pub const OPENCHAT_BOT: UserId = UserId::new(OPENCHAT_BOT_PRINCIPAL);
pub const OPENCHAT_BOT_USERNAME: &str = "OpenChat Bot";

#[test]
fn bot() {
    println!("{:?}", OPENCHAT_BOT);
}
