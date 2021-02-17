import React, { useState } from "react";
import ChatList from "./ChatList";
import SideHeader from "./SideHeader";
import SearchResults from "./SearchResults";

export default React.memo(Side);

function Side() {
    const [inputText, setInputText] = useState("");

    const contentPanel = inputText.length
        ? <SearchResults searchTerm={inputText} clearSearchTerm={() => setInputText("")} />
        : <ChatList />;

    return (
        <>
            <SideHeader text={inputText} setText={setInputText} />
            {contentPanel}
        </>
    );
}
