### To create a connection from User1 to User2

### User1
- check that User2 is online
- create new RtcPeerConnection
- create a datachannel on the RtcPeerConnection
- create an offer
- wait for the ICE candidates to be resolved
- send offer containing the ICE candidates to the IC specifying that it is for User2

### User2
- grab offer from User1 (polling every second via a query call)
- remove offer from IC (update call) (solely to clear up memory)
- create new RtcPeerConnection
- add the offer from User1 to the RtcPeerConnection
- once the offer has been added we store a ref to the datachannel included in the offer
- create an answer to User1's offer
- wait for the ICE candidates to be resolved
- send answer containing the ICE candidates to the IC specifying that it is for User1

### User1
- grab answer from User2 (polling every second via a query call)
- remove answer from IC (update call) (solely to clear up memory)
- add the answer from User2 to the RtcPeerConnection
  
At this point User1 and User2 can send messages p2p