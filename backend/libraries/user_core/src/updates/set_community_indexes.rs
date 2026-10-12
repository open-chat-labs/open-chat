use crate::User;
use multi_user_canister::set_community_indexes::Args;
use types::{TimestampMillis, Timestamped};

pub fn set_community_indexes(user: &mut User, args: Args, now: TimestampMillis) {
    for (community_id, index) in args.indexes {
        if let Some(mut community) = user.communities.get_mut(&community_id) {
            community.index = Timestamped::new(index, now);
        }
    }
}
