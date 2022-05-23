use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::Timestamped;
use user_canister::set_preferences::*;

#[update(guard = "caller_is_owner")]
#[trace]
fn set_preferences(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_preferences_impl(args, state))
}

fn set_preferences_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let pref_args = &args.preferences;
    let pref_data = &mut runtime_state.data.user_preferences;

    if let Some(enter_key_sends) = pref_args.enter_key_sends {
        pref_data.enter_key_sends = Timestamped::new(enter_key_sends, now);
    }
    if let Some(enable_animations) = pref_args.enable_animations {
        pref_data.enable_animations = Timestamped::new(enable_animations, now);
    }
    if let Some(night_mode) = pref_args.night_mode {
        pref_data.night_mode = Timestamped::new(night_mode, now);
    }
    if let Some(large_emoji) = pref_args.large_emoji {
        pref_data.large_emoji = Timestamped::new(large_emoji, now);
    }
    if let Some(use_system_emojis) = pref_args.use_system_emojis {
        pref_data.use_system_emojis = Timestamped::new(use_system_emojis, now);
    }
    if let Some(generate_link_previews) = pref_args.generate_link_previews {
        pref_data.generate_link_previews = Timestamped::new(generate_link_previews, now);
    }
    if let Some(language) = &pref_args.language {
        pref_data.language = Timestamped::new(language.clone(), now);
    }
    if let Some(notification_prefs) = &pref_args.notification_preferences {
        if let Some(direct_chats) = notification_prefs.direct_chats {
            pref_data.notification_preferences.direct_chats = Timestamped::new(direct_chats, now);
        }
        if let Some(private_group_chats) = notification_prefs.private_group_chats {
            pref_data.notification_preferences.private_group_chats = Timestamped::new(private_group_chats, now);
        }
        if let Some(public_group_chats) = notification_prefs.public_group_chats {
            pref_data.notification_preferences.public_group_chats = Timestamped::new(public_group_chats, now);
        }
        if let Some(silent) = notification_prefs.silent {
            pref_data.notification_preferences.silent = Timestamped::new(silent, now);
        }
        if let Some(vibrate) = notification_prefs.vibrate {
            pref_data.notification_preferences.vibrate = Timestamped::new(vibrate, now);
        }
    }

    Response::Success
}
