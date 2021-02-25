# Code
- Error handling - in particular around canister calls
- Ensure components return only required state from useSelector hook 
- Split reducers into a handler per message
- Use interfaces for core chat and message models
- Use a request object for each canister API method
- Give each chat a client-generated uuid
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
- <del>Emoticons</del>
- Authentication
- <del>Read receipts</del>
- Delete my account
- Find contacts (phone number, email, ...)
- Add contacts
- <del>Send images</del>
- <del>Send videos</del>
- Captions on images and video
- Audio message
- Stream videos
- Fully responsive to mobile devices
- Dark-mode
- Send cycles / tokens
- Block contact
- Draft/notes area 
- Browser push notifications
- <del>Peer 2 peer</del>
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
- iOS app
- Android app

# Scalability

- Have auto-inc participant ids for group chat so that each message has this id rather than the large principal
- Shard chats

# Questions
- Authentication - how can we get to an MVP to be able to demo open-chat on IC?
- Sending cycles to users - would be good to discuss the shape of the API which we can then mock
- Writing e2e tests - we want to be able to use the generated .js for canister endpoints but with the principal as a parameter
- Serve assets like images over http from canister
- Circumvent 2Mb limit so we can run FE code in development mode
- How close are clocks on different canisters around the world?

# Bugs
- Emoji Picker categories don't seem to work until the the picker has been used (https://github.com/missive/emoji-mart/issues/473)
- <del>Messages being de-duped by content + sender. Instead give each message a client generated uuid (can be removed server-side once confirmed to save space)</del>
- The UI is not shrinking properly when there is a chat whose latest message is quite long
- Cross-browser render issues in general
- Validation - usernanme length, group name length, message length etc
- Lots of places where long content is not overflowing/scrolling properly
- <del>Memory leak on client due to storing media blobs in main memory. We should make use of http cache. Would be good if we could serve images from canister over http</del>
- In message box
  0 Add emoji
  0 Delete emoji
  0 Type test and it appear in font-size: 18px span
- Add multiple emojis in a row and they appear on separate lines
- If the user changes their profile image the old image is currently orphaned on the IC and never deleted. Could solve by using the userId (+prefix) as the data key and also storing a version number with data in general, so that when the serving of content over http is supported, we can use etag caching based on the version number

# Micro-features
- <del>Store draft message with each chat on client</del>
- <del>Support line-breaks in messages</del>
- <del>Placeholder text in message input box</del>
- <del>Store avatar image against user in user_mgmt canister</del>
- Serve images/video over http and so take advantage of http caching.
- Support bold italics etc in messages
- Change name of group chat
- <del>UI support for creating chats (should be able to select from all users known to me)</del>
- Dropdown menu on each message
  - Delete message
  - Star message
  - Reply to message
  - Forward message