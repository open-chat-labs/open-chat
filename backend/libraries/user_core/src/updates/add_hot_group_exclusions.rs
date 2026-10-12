use crate::User;
use multi_user_canister::add_hot_group_exclusions::Args;
use types::TimestampMillis;

pub fn add_hot_group_exclusions(user: &mut User, args: Args, now: TimestampMillis) {
    for group in args.groups {
        user.hot_group_exclusions.add(group, args.duration, now);
    }
}
