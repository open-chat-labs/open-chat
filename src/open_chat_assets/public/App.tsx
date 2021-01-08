import React from "react";

import { setupBackgroundTasks } from "./backgroundTasks";

import Main from "./components/Main";
import Side from "./components/Side";

export default App;

function App() {
    setupBackgroundTasks();

    return (
        <div style={{ display:"flex", width:"100%", height:"100%" }}>
            <div style={{ flex:"40%" }}>
                <Side />
            </div>
            <div style={{ flex:"60%" }}>
                <Main />
            </div>
        </div>
    );
}
