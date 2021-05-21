import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
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
import AlertDialog from "./AlertDialog";
import logout from "../actions/signin/logout";
import { closeAlertDialog } from "../actions/showAlertDialog";
import aboutUs from "../actions/aboutUs";

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
        width: "30%"
    }
}));

function App() {
    const dispatch = useDispatch();
    const classes = useStyles();
    const sidePanelState = useSelector((state: RootState) => state.sidePanelState);
    const alert = useSelector((state: RootState) => state.appState.alert);

    useEffect(() => {
        dispatch(aboutUs());
    }, []);

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
                <Grid
                    item
                    container
                    direction="column"
                    wrap="nowrap"
                    className={classes.right}>
                    <RightPanel type={sidePanelState.rightPanel} />
                </Grid>
            </>
        );
    }

    return (
        <>
            <Grid container wrap="nowrap" className={classes.grid}>
                {buildLeftPanel(sidePanelState)}
                {buildMainPanel(sidePanelState)}
                {buildRightPanel(sidePanelState)}
            </Grid>
            {alert ?
            <AlertDialog
                content={alert}
                onClose={() => dispatch(closeAlertDialog())}
                 /> : null}
        </>
    );
}


