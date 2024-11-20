use types::{TimestampMillis, UserId};

pub trait Member {
    fn user_id(&self) -> UserId;
    fn is_owner(&self) -> bool;
    fn lapsed(&self) -> bool;
    fn set_lapsed(&mut self, lapsed: bool, timestamp: TimestampMillis) -> bool;

    fn can_member_lapse(&self) -> bool {
        !self.is_owner() && !self.lapsed()
    }
}

pub trait Members {
    type Member: Member;

    fn get(&self, user_id: &UserId) -> Option<&Self::Member>;

    fn iter_members_who_can_lapse(&self) -> Box<dyn Iterator<Item = UserId> + '_>;

    fn can_member_lapse(&self, user_id: &UserId) -> bool {
        self.get(user_id).map_or(false, |m| m.can_member_lapse())
    }
}
