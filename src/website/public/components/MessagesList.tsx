import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";
import DirectMessageSentByThem from "./messages/DirectMessageSentByThem";
import GroupMessageSentByElse from "./messages/GroupMessageSentByElse";
import MessageSentByMe from "./messages/MessageSentByMe";
import RemoteMessage from "./messages/RemoteMessage";

export default MessagesList;

function MessagesList() {
    const myUserId = useSelector((state: RootState) => state.usersState.me?.userId);
    const usersDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chatsState = useSelector((state: RootState) => state.chatsState);

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    const confirmedMessages = chat.kind === "direct"
        ? chat.confirmedMessages.map(m => {
            switch (m.kind) {
                case "local":
                    const sentByMe = m.sender === myUserId;
                    if (sentByMe) {
                        const props = {
                            message: m.text,
                            timestamp: m.timestamp,
                            confirmed: true
                        };
                        return <MessageSentByMe key={m.id} {...props} />;
                    } else if (chat.kind === "direct") {
                        const props = {
                            message: m.text,
                            timestamp: m.timestamp
                        };
                        return <DirectMessageSentByThem key={m.id} {...props} />;
                    } else {
                        const props = {
                            message: m.text,
                            timestamp: m.timestamp,
                            senderUsername: usersDictionary.hasOwnProperty(m.sender) ? usersDictionary[m.sender] : ""
                        };
                        return <GroupMessageSentByElse key={m.id} {...props} />;
                    }

                case "remote":
                    return <RemoteMessage key={m.id} />
            }
        })
        : null;

    const unconfirmedMessages = chat.unconfirmedMessages.map(m => {
        const props = {
            message: m.text,
            timestamp: m.timestamp,
            confirmed: false
        };
        return <MessageSentByMe key={"u-" + m.timestamp} {...props} />;
    });

    return (
        <div id="messages">
            {confirmedMessages}
            {unconfirmedMessages}
        </div>
    );
}
