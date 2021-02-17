import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import UserMenu from "./UserMenu";
import MyAvatar from "./MyAvatar";
import SearchBox from "./SearchBox";

const PLACEHOLDER_TEXT = "Search chats, users and messages";

export default React.memo(SideHeader);

type Props = {
    text: string,
    setText: (text: string) => void
}

function SideHeader(props: Props) {
    const myUsername = useSelector((state: RootState) => state.usersState.me?.username)!;

    return (
        <>
            <header>
                <MyAvatar />    
                <div className="my-display-name"><a href="#">{myUsername}</a></div>
                <div className="user-menu-container"><UserMenu /></div>
            </header>
            <SearchBox text={props.text} onChange={props.setText} defaultPlaceholderText={PLACEHOLDER_TEXT} />
        </>
    );
}
