import React from "react";
import { useSelector } from "react-redux";

import { RootState } from "../reducers";
import DayChangeMarker from "./messages/DayChangeMarker";
import DirectMessageSentByThem from "./messages/DirectMessageSentByThem";
import GroupMessageSentByElse from "./messages/GroupMessageSentByElse";
import MessageSentByMe from "./messages/MessageSentByMe";
import RemoteMessage from "./messages/RemoteMessage";
import * as timestamp from "../utils/timestamp";

export default MessagesList;

function MessagesList() {
    const myUserId = useSelector((state: RootState) => state.usersState.me?.userId);
    const usersDictionary: any = useSelector((state: RootState) => state.usersState.userDictionary);
    const chatsState = useSelector((state: RootState) => state.chatsState);

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    const children: JSX.Element[] = [];

    if (chat.kind !== "newDirect") {
        let prevDate: Date | null = null;
        let prevDayString: string | null = null;
        for (let i = 0; i < chat.confirmedMessages.length; i++) {
            const message = chat.confirmedMessages[i];
            if (message.kind === "local") {
                const date = timestamp.asDate(message.timestamp);
                const dayString = date.toDateString();
                if (prevDayString === null || prevDayString !== dayString) {
                    children.push(<DayChangeMarker key={dayString} date={date}/>);
                }

                const sentByMe = message.sender === myUserId;
                if (sentByMe) {
                    const props = {
                        message: message.text,
                        date,
                        confirmed: true
                    };
                    children.push(<MessageSentByMe key={message.id} {...props} />);
                } else if (chat.kind === "direct") {
                    const props = {
                        message: message.text,
                        date
                    };
                    children.push(<DirectMessageSentByThem key={message.id} {...props} />);
                } else {
                    const props = {
                        message: message.text,
                        date,
                        senderUsername: usersDictionary.hasOwnProperty(message.sender)
                            ? usersDictionary[message.sender]
                            : ""
                    };
                    children.push(<GroupMessageSentByElse key={message.id} {...props} />);
                }
                prevDate = date;
                prevDayString = dayString;
            } else if (message.kind === "remote") {
                children.push(<RemoteMessage key={message.id}/>);
            }
        }
    }

    for (let i = 0; i < chat.unconfirmedMessages.length; i++) {
        const message = chat.unconfirmedMessages[i];
        const props = {
            message: message.text,
            date: timestamp.asDate(message.timestamp),
            confirmed: false
        };
        children.push(<MessageSentByMe key={"u-" + message.timestamp} {...props} />);
    }

    return (
        <div id="messages">
            {children}
        </div>
    );
}
