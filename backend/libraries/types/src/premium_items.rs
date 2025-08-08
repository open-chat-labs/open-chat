use crate::TimestampMillis;
use candid::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PremiumItemPurchase {
    pub timestamp: TimestampMillis,
    pub item_id: u32,
    pub paid_in_chat: bool,
    pub cost: u32,
}
