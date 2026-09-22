use constants::LIFETIME_DIAMOND_TIMESTAMP;
use types::TimestampMillis;

pub const COMMUNITY_CREATION_LIMIT: u32 = 10;

pub enum Membership {
    Basic,
    Diamond,
    LifetimeDiamond,
}

impl Membership {
    // The user's membership given when their Diamond membership expires, if they have ever had one
    pub fn new(diamond_membership_expires_at: Option<TimestampMillis>, now: TimestampMillis) -> Membership {
        match diamond_membership_expires_at {
            Some(ts) if ts > LIFETIME_DIAMOND_TIMESTAMP => Membership::LifetimeDiamond,
            Some(ts) if ts > now => Membership::Diamond,
            _ => Membership::Basic,
        }
    }

    pub fn is_diamond_member(&self) -> bool {
        matches!(self, Membership::Diamond | Membership::LifetimeDiamond)
    }

    pub fn group_creation_limit(&self) -> u32 {
        match self {
            Membership::Basic => 5,
            Membership::Diamond => 40,
            Membership::LifetimeDiamond => 100,
        }
    }
}
