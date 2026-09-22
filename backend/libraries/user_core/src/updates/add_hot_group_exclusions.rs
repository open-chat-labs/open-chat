use crate::User;
use types::TimestampMillis;
use user_canister::add_hot_group_exclusions::Args;

pub fn add_hot_group_exclusions(user: &mut User, args: Args, now: TimestampMillis) {
    for group in args.groups {
        user.hot_group_exclusions.add(group, args.duration, now);
    }
}
