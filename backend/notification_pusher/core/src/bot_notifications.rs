use crate::BotNotification;
use crate::bot_notifications::pusher::Pusher;
use async_channel::Sender;

mod pusher;

pub fn start_bot_notifications_processor() -> Sender<BotNotification> {
    let (sender, receiver) = async_channel::bounded::<BotNotification>(200_000);

    let pusher = Pusher::new(receiver);
    tokio::spawn(pusher.run());

    sender
}
