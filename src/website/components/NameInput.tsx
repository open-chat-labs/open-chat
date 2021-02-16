import React, { useEffect, useState } from "react";
import Tick from "../assets/icons/tick2.svg";

export default React.memo(NameInput);

type Props = {
    onSubmit: (text: string) => void,
    defaultPlaceholderText: string,
    maxLength: number
}

function NameInput(props: Props) {
    const [text, setText] = useState("");
    const [remainingCharCount, setRemainingCharCount] = useState(props.maxLength);
    const [showSubmit, setShowSubmit] = useState(false);
    const clearInput = () => setText("");

    function handleSubmit() {
        if (text.length < 1) {
            return;
        }
        props.onSubmit(text);
        clearInput();
    }

    function handleInputChange(text: string) {
        setShowSubmit(text.length > 0);
        setText(text);
        setRemainingCharCount(props.maxLength - text.length);
    }

    function handleKeyPress(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter") {
            handleSubmit();
            e.preventDefault();
        }
    }

    useEffect(() => {
        document.getElementById("nameInput")?.focus();
    }, []);    

    return <div className="name-input">
        <div className="name-input-container">
            <input
                id="nameInput"
                type="text"
                value={text}
                onChange={e => handleInputChange(e.target.value)}
                placeholder={props.defaultPlaceholderText}
                onKeyDown={handleKeyPress}
                maxLength={props.maxLength} />

            <span>{remainingCharCount}</span>
        </div>
        {showSubmit ? <button onClick={_ => handleSubmit()}><Tick /></button> : null}
    </div>;
}