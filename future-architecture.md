## Canisters

### UserManagement

- register_user
- lookup_users (query)

### User

- send_direct_message
- create_group_chat
- add_group_chat_participants
- remove_group_chat_participants
- mark_messages_as_read
- delete_webrtc_connection_details
- tag_message
- delete_message
- handle_direct_message
- handle_messages_marked_as_read
- handle_group_chat_updated
- handle_webrtc_connection_details
- get_messages (query)
- search_messages (query)
- get_updates (query)

'get_updates' will internally get updated chats, WebRTC connection details and user details.
This will involve having to make inter-canister query calls.

### GroupChat

- send_message
- add_participants
- remove_participants
- mark_messages_as_read
- mark_inactive
- get_updates (query)

Whilst a group chat is 'active', it will be polled by any participants who are
online. Once a group chat has had no activity for a certain period it will be
marked as 'inactive'. If an update is received by an 'inactive' group chat, it
will set its state to 'active' and push a message to each participant's
canister alerting them of the state change.

### Data (OpenStorage?)

- create_file
- put_chunk
- get_chunk (query)
