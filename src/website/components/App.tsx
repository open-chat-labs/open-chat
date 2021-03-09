import React from "react";
import { useSelector } from "react-redux";
import Divider from "@material-ui/core/Divider";
import Grid from "@material-ui/core/Grid";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { RootState } from "../reducers";
import { Option } from "../domain/model/common";
import { SidePanelState } from "../reducers/sidePanelReducer";
import { RightPanelType } from "../actions/changeSidePanel";
import LeftPanel from "./leftPanel/LeftPanel";
import MainPanel from "./mainPanel/MainPanel";
import RightPanel from "./rightPanel/RightPanel";
import { setupBackgroundTasks } from "../backgroundTasks";

export default App;

const useStyles = makeStyles((theme: Theme) => ({
    grid: {
        height: "100%",
        overflow: "hidden",
        backgroundColor: theme.colors.sidePanel.backgroundColor
    },
    left: {
        height: "100%",
        width: "40%",
        color: theme.colors.sidePanel.textColor,
        "&.rightPanelActive": {
            width: "30%"
        }
    },
    main: {
        height: "100%",
        backgroundColor: theme.colors.mainPanel.backgroundColor,
        width: "60%",
        "&.rightPanelActive": {
            width: "40%"
        }
    },
    right: {
        height: "100%",
        width: "30%",
        color: theme.colors.sidePanel.textColor
    }
}));

function App() {
    const classes = useStyles();
    const sidePanelState = useSelector((state: RootState) => state.sidePanelState);

    setupBackgroundTasks();

    function buildLeftPanel(sidePanelState: SidePanelState): JSX.Element {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;
        let className = classes.left;
        if (rightPanelActive) {
            className += " rightPanelActive";
        }

        return (
            <>
                <Grid
                    item
                    container
                    direction="column"
                    wrap="nowrap"
                    className={className}>
                    <LeftPanel type={sidePanelState.leftPanel} />
                </Grid>
                <Divider orientation="vertical" flexItem />
            </>
        );
    }

    function buildMainPanel(sidePanelState: SidePanelState): JSX.Element  {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;
        let className = "main-panel " + classes.main;
        if (rightPanelActive) {
            className += " rightPanelActive";
        }

        return (
            <Grid
                item
                container
                direction="column"
                className={className}>
                <MainPanel />
            </Grid>
        );
    }

    function buildRightPanel(sidePanelState: SidePanelState): Option<JSX.Element>  {
        if (sidePanelState.rightPanel === RightPanelType.None) {
            return null;
        }

        return (
            <>
                <Divider orientation="vertical" flexItem />
                <Grid item className={classes.right}>
                    <RightPanel type={sidePanelState.rightPanel} />
                </Grid>
            </>
        );
    }

    return (
        <Grid container wrap="nowrap" className={classes.grid}>
            {buildLeftPanel(sidePanelState)}
            {buildMainPanel(sidePanelState)}
            {buildRightPanel(sidePanelState)}
        </Grid>
    );
}
