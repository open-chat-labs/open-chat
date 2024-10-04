use types::{TimestampMillis, Timestamped, UserId};

pub trait Member {
    fn user_id(&self) -> UserId;
    fn is_owner(&self) -> bool;
    fn lapsed(&self) -> bool;
    fn set_lapsed(&mut self, lapsed: Timestamped<bool>);

    fn lapse(&mut self, now: TimestampMillis) {
        self.set_lapsed(Timestamped::new(true, now));
    }

    fn clear_lapsed(&mut self, now: TimestampMillis) {
        self.set_lapsed(Timestamped::new(false, now));
    }

    fn can_member_lapse(&self) -> bool {
        !self.is_owner() && !self.lapsed()
    }
}

pub trait Members {
    type Member: Member;

    fn get(&self, user_id: &UserId) -> Option<&Self::Member>;
    fn get_mut(&mut self, user_id: &UserId) -> Option<&mut Self::Member>;
    fn iter(&self) -> impl Iterator<Item = &Self::Member>;
    fn iter_mut(&mut self) -> impl Iterator<Item = &mut Self::Member>;

    fn clear_lapsed(&mut self, now: TimestampMillis) {
        for m in self.iter_mut() {
            m.clear_lapsed(now);
        }
    }

    fn can_member_lapse(&self, user_id: &UserId) -> bool {
        self.get(user_id).map_or(false, |m| m.can_member_lapse())
    }

    fn mark_member_lapsed(&mut self, user_id: &UserId, now: TimestampMillis) {
        if let Some(member) = self.get_mut(user_id) {
            if !member.is_owner() {
                member.lapse(now);
            }
        }
    }
}
