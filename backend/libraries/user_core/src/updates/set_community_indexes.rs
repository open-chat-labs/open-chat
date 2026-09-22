use crate::User;
use types::{TimestampMillis, Timestamped};
use user_canister::set_community_indexes::Args;

pub fn set_community_indexes(user: &mut User, args: Args, now: TimestampMillis) {
    for (community_id, index) in args.indexes {
        if let Some(community) = user.communities.get_mut(&community_id) {
            community.index = Timestamped::new(index, now);
        }
    }
}
