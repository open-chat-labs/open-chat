import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../reducers";
import sendMessage from "../actions/chats/sendMessage";
import Paperclip from "../assets/icons/paperclip.svg";
import SendButton from "../assets/icons/sendButton.svg";

export default MainFooter;

function MainFooter() {
    const dispatch = useDispatch();
    const chatsState = useSelector((state: RootState) => state.chatsState);
    const [newMessageText, setNewMessageText] = useState("");

    if (chatsState.selectedChatIndex === null) {
        return <div></div>;
    }

    const chat = chatsState.chats[chatsState.selectedChatIndex];

    return (
        <footer className="enter-message">
            <label className="attach">
                <Paperclip />
                <input 
                    className="hide" 
                    type="file" 
                    accept="image/*,video/mp4,video/webm,video/ogg" 
                    onChange={onMediaSelected}/>
            </label>
            <input
                id="newMessage"
                value={newMessageText}
                placeholder="Type a message"
                onChange={e => setNewMessageText(e.target.value)}
                onKeyDown={handleKeyPress} />
            <button onClick={handleSendMessage} className="send">
                <SendButton />
            </button>
        </footer>
    );

    function handleSendMessage() {
        if (newMessageText) {
            dispatch(sendMessage(chat, { kind: "text", text: newMessageText }));
        }
        setNewMessageText("");
        //scrollMessagesToBottom()
    }

    function handleKeyPress(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter") {
            handleSendMessage();
        }
    }

    function onMediaSelected(event: any) {
        let files = event.target.files;
        if (!files || !files[0]) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e: any) {
            dispatch(sendMessage(chat, { 
                kind: "media", 
                caption: null,
                // TODO: Could try sniffing file for mimetype
                // https://stackoverflow.com/questions/18299806/how-to-check-file-mime-type-with-javascript-before-upload
                mimeType: files[0].type,
                blob: e.target.result
            }));
        }
        reader.readAsDataURL(files[0]);
    }    
}
