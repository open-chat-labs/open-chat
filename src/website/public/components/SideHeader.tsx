import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../reducers";
import SideHeaderMenu from "./SideHeaderMenu";
import DefaultAvatar from "./defaultAvatar";
import SearchIcon from "../assets/icons/search.svg";

export default SideHeader;

const PLACEHOLDER_TEXT = "Search or start a new chat";

function SideHeader() {
    const usersState = useSelector((state: RootState) => state.usersState);
    const [text, setText] = useState("");
    const [placeholderText, setPlaceholderText] = useState(PLACEHOLDER_TEXT);

    return (
        <>
            <header>
                <button className="avatar-button">
                    <DefaultAvatar userId={usersState.me?.userId ?? null} />
                </button>
                <div>
                    <SideHeaderMenu text={text} />
                </div>
            </header>
            <div className="search">
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={placeholderText}
                    onFocus={_ => setPlaceholderText("")}
                    onBlur={_ => setPlaceholderText(PLACEHOLDER_TEXT)} />
                <SearchIcon />
            </div>
        </>
    );
}
