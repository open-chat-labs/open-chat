import React, { useState } from "react";

import SideHeaderMenu from "./SideHeaderMenu";
import MyAvatar from "./MyAvatar";
import SearchIcon from "../assets/icons/search.svg";

const PLACEHOLDER_TEXT = "Search or start a new chat";

export default React.memo(SideHeader);

function SideHeader() {
    const [text, setText] = useState("");
    const [placeholderText, setPlaceholderText] = useState(PLACEHOLDER_TEXT);
    const clearInput = () => setText("");

    return (
        <>
            <header>
                <MyAvatar />    
                <div>
                    <SideHeaderMenu text={text} clearInput={clearInput} />
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
