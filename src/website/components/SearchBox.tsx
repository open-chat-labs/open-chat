import React, { useEffect, useState } from "react";
import SearchIcon from "../assets/icons/search.svg";

export default React.memo(SearchBox);

type Props = {
    text: string,
    onChange: (text: string) => void,
    defaultPlaceholderText: string
}

function SearchBox(props: Props) {
    const [placeholderText, setPlaceholderText] = useState(props.defaultPlaceholderText);

    useEffect(() => {
        document.getElementById("searchBox")?.focus();
    }, []);    

    return <div className="search">
        <input
            id="searchBox"
            value={props.text}
            onChange={e => props.onChange(e.target.value)}
            placeholder={placeholderText}
            onFocus={_ => setPlaceholderText("")}
            onBlur={_ => setPlaceholderText(props.defaultPlaceholderText)} />
        <SearchIcon />
    </div>;
}