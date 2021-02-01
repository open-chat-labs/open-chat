# Code
- Error handling - in particular around canister calls
- Ensure components return only required state from useSelector hook 
- Split reducers into a handler per message
- Tests

# Features

- Star message (and other tags)
- Filter by starred messages (and other tags)
- User
  - Name
  - Phone number
  - Email
  - Avatar
  - About
  - Status
  - QR code (principal)
- Emoticons
- Authentication
- Read receipts
- Delete my account
- Find contacts (phone number, email, ...)
- Add contacts
- Send images + caption
- Send cycles / tokens
- Block contact
- Draft/notes area 
- Send video + caption
- User preferences
  - keep messages
  - keep transactional messages
  - read receipts on/off
  - permissions to see the various user info
- Voice call
- Video call
- Group video call
- Live location
- User stories (short videos that live for 24 hours against a user account)
- Browser push notifications
- iOS app
- Android app

# Scalability

- Have auto-inc participant ids for group chat so that each message has this id rather than the large principal
- Shard chats

# Performance

- Peer-to-peer

# Questions

- Authentication - how can we get to an MVP to be able to demo open-chat on IC?
- Sending cycles to users - would be good to discuss the shape of the API which we can then mock
- Writing e2e tests - we want to be able to use the generated .js for canister endpoints but with the principal as a parameter
- Serve assets like images over http from canister
- Circumvent 2Mb limit so we can run FE code in development mode
- 