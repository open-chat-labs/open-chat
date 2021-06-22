Canisters
---------
Controller
UserIndex
GroupIndex
User
Group
X P2P
X Notifications
Website


Getting latest messages
-----------------------
1. Over WebRTC
2. By Webpush notification 
  2.1 For direct chats and unmuted private groups send notifications immediately
  2.2 Otherwise send notifications in batches
3. By polling own user canister (every 20 secs)
4. By polling group canisters (depends on how recent was the last message)