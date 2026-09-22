use crate::User;
use types::c2c_can_issue_access_token::AccessTypeArgs;

// Whether the LocalUserIndex may issue the access token: a bot acting by command must have been
// granted the permissions it requests, and the initiator of a video call must not be blocked
pub fn c2c_can_issue_access_token(user: &User, args: AccessTypeArgs) -> bool {
    match &args {
        AccessTypeArgs::BotActionByCommand(args) => user
            .bots
            .get(&args.bot_id)
            .is_some_and(|bot| args.requested_permissions.is_subset(&bot.permissions)),
        AccessTypeArgs::StartVideoCall(args) => !user.blocked_users.contains(&args.initiator),
        AccessTypeArgs::JoinVideoCall(args) => !user.blocked_users.contains(&args.initiator),
        AccessTypeArgs::MarkVideoCallAsEnded(args) => !user.blocked_users.contains(&args.initiator),
    }
}
