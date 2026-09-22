use crate::User;
use oc_error_codes::OCErrorCode;
use types::{
    BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, OCResult, TimestampMillis, UserId,
};
use user_canister::update_bot::Args;

// Updates the permissions the user grants the bot, returning the notification to send the bot
pub fn update_bot(user: &mut User, args: Args, my_user_id: UserId, now: TimestampMillis) -> OCResult<BotNotification> {
    user.verify_not_suspended()?;

    if !user.update_bot_permissions(
        args.bot_id,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        now,
    ) {
        return Err(OCErrorCode::BotNotFound.into());
    }

    Ok(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by: my_user_id,
            location: BotInstallationLocation::User(my_user_id.into()),
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
        timestamp: now,
    })
}
