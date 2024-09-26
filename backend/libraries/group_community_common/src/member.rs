use types::{TimestampMillis, UserId};

pub trait Member {
    fn user_id(&self) -> UserId;
    fn is_owner(&self) -> bool;
    fn lapsed(&self) -> Option<TimestampMillis>;
    fn set_lapsed(&mut self, lapsed: Option<TimestampMillis>);

    fn lapse(&mut self, now: TimestampMillis) {
        self.set_lapsed(Some(now));
    }

    fn clear_lapsed(&mut self) {
        self.set_lapsed(None);
    }

    fn can_member_lapse(&self) -> bool {
        !self.is_owner() && self.lapsed().is_none()
    }
}

pub trait Members<M: Member + 'static> {
    fn get(&self, user_id: &UserId) -> Option<&M>;
    fn get_mut(&mut self, user_id: &UserId) -> Option<&mut M>;
    fn iter(&self) -> impl Iterator<Item = &M>;
    fn iter_mut(&mut self) -> impl Iterator<Item = &mut M>;

    fn clear_lapsed(&mut self) {
        for m in self.iter_mut() {
            m.clear_lapsed();
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
