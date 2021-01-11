import React, { useState } from "react";
import { useDispatch } from "react-redux";

import setupNewDirectChat from "../actions/chats/setupNewDirectChat";

const DEFAULT_TEXT = "Search or start a new chat";

export default SideHeader;

function SideHeader() {
    const [text, setText] = useState(DEFAULT_TEXT);
    const dispatch = useDispatch();

    return (
        <>
            <header>
                <button><img className="avatar" src="../../design/mattg.jpeg"/></button>
                <div>
                    <button className="add-chat" onClick={_ => dispatch(setupNewDirectChat(text))}>Add chat</button>
                    <button className="add-group">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 0 36 32" width="36" height="32">
                            <path fill="currentColor"
                                  d="M15.313 15.672c2.401 0 4.237-1.835 4.237-4.235S17.713 7.2 15.313 7.2s-4.235 1.836-4.235 4.237 1.834 4.235 4.235 4.235zm9.349-.64c1.571 0 2.773-1.201 2.773-2.772 0-1.571-1.202-2.773-2.773-2.773s-2.772 1.202-2.772 2.773c0 1.571 1.201 2.772 2.772 2.772zm-1.724 5.841a7.856 7.856 0 0 0-.889-1.107 8.074 8.074 0 0 0-1.825-1.413 9.05 9.05 0 0 0-.675-.346l-.021-.009c-1.107-.502-2.5-.851-4.232-.851-1.732 0-3.124.349-4.232.851l-.112.054a9.247 9.247 0 0 0-.705.374 8.137 8.137 0 0 0-1.705 1.341 7.991 7.991 0 0 0-.656.773 8.584 8.584 0 0 0-.233.334c-.063.095-.116.184-.164.263l-.012.02a4.495 4.495 0 0 0-.213.408v2.276h16.061v-2.276s-.07-.164-.225-.427a4.257 4.257 0 0 0-.162-.265zm1.724-4.357c-1.333 0-2.376.3-3.179.713a9.409 9.409 0 0 1 1.733 1.218c1.402 1.25 1.959 2.503 2.017 2.641l.021.049h4.954v-1.571s-1.294-3.05-5.546-3.05zM9.41 13.78H6.261v-3.152H4.344v3.152H1.2v1.918h3.144v3.145h1.917v-3.145H9.41V13.78z"></path>
                        </svg>
                    </button>
                </div>
            </header>
            <div className="search">
                <input value={text} onFocus={_ => setText("")} onChange={e => setText(e.target.value)} />
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor"
                          d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"></path>
                </svg>
            </div>
        </>
    );
}
