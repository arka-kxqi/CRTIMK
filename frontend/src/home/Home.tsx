import {Box, Paper, Typography} from "@mui/material";
import React, {useContext, useEffect, useTransition} from "react";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
import ComputerIcon from "@mui/icons-material/Computer";
import {isSignedInState, ONE_YOCTO_NEAR, WalletContext} from "../app";
import {atom, selector, useRecoilState_TRANSITION_SUPPORT_UNSTABLE} from "recoil";
import {useNavigate} from "react-router";
import {default as NearBadge} from "../../assets/svg/near-brand-badge.png";
import {NEAR} from "near-units";
import {wallet} from "../index";
import {yoctoNear} from "../common/near-wallet";

const paperStyle = {
    margin: "24px",
    width: "30%",
    height: "250px",
    textAlign: "center",
};

const iconStyle = {
    paddingTop: "10px",
    width: "50px",
    height: "50px",
};

const selfPayoutsSelector = selector({
    key: "selfPayoutsSelector",
    get: async ({get}) => {
        const isSignedIn = get(isSignedInState);
        return isSignedIn ? await wallet.getLifetimeEarningsForOwner() : 0;
    },
});

const selfNodeCountSelector = selector({
    key: "selfNodeCountSelector",
    get: async ({get}) => {
        const isSignedIn = get(isSignedInState);
        return isSignedIn ? await wallet.getNodesOwnedBySelfCount() : 0;
    },
});


const selfBountyCountSelector = selector({
    key: "selfBountyCountSelector",
    get: async ({get}) => {
        const isSignedIn = get(isSignedInState);
        return isSignedIn ? await wallet.getBountiesOwnedBySelfCount() : 0;
    },
});

const totalPayoutsSelector = selector({
    key: "totalPayoutsSelector",
    get: async ({get}) => {
        return await wallet.getTotalPayouts();
    },
});

const bountiesCountSelector = selector({
    key: "bountiesCountSelector",
    get: async ({get}) => {
        return await wallet.getBountyCount();
    },
});

const nodesCountSelector = selector({
    key: "nodesCountSelector",
    get: async ({get}) => {
        return await wallet.getNodeCount();
    },
});

const selfPayoutsState = atom({
key: "selfPayoutsState",
default: selfPayoutsSelector,
})

const selfNodeCountState = atom({
    key: "selfNodeCountState",
    default: selfNodeCountSelector,
})
const selfBountyCountState = atom({
  key: "selfBountyCountState",
    default: selfBountyCountSelector,
})
const totalPayoutsState = atom({
    key: "totalPayoutsState",
    default: totalPayoutsSelector,
})
const bountiesCountState = atom({
    key: "totalBountiesState",
    default: bountiesCountSelector,
})
const nodesCountState = atom({
    key: "nodesCountState",
    default: nodesCountSelector,
})

export default function Home({isSignedIn}: { isSignedIn: boolean }) {
    const wallet = useContext(WalletContext);
    const navigate = useNavigate();

    const [totalSelfEarnings, setTotalSelfEarnings] = useRecoilState_TRANSITION_SUPPORT_UNSTABLE(selfPayoutsState);
    const [totalSelfBounties, setTotalSelfBounties] = useRecoilState_TRANSITION_SUPPORT_UNSTABLE(selfBountyCountState);
    const [totalSelfNodes, setTotalSelfNodes] = useRecoilState_TRANSITION_SUPPORT_UNSTABLE(selfNodeCountState);

    const [totalPayouts, setTotalPayouts] = useRecoilState_TRANSITION_SUPPORT_UNSTABLE(totalPayoutsState);
    const [totalBounties, setTotalBounties] = useRecoilState_TRANSITION_SUPPORT_UNSTABLE(bountiesCountState);
    const [totalNodes, setTotalNodes] = useRecoilState_TRANSITION_SUPPORT_UNSTABLE(nodesCountState);
    const [inTransition, startTransition] = React.useTransition();


    useEffect(() => {
        const updateHomepage = async () => {
            console.log(isSignedIn)
            const totalSelfNodes = isSignedIn ? await wallet.getNodesOwnedBySelfCount() : 0;
            const totalSelfEarnings = isSignedIn ? await wallet.getLifetimeEarningsForOwner() : 0;
            const totalSelfBounties = isSignedIn ? await wallet.getBountiesOwnedBySelfCount() : 0;
            const totalPayouts = await wallet.getTotalPayouts();
            const totalBounties = await wallet.getBountyCount();
            const totalNodes = await wallet.getNodeCount();
            startTransition(() => {
                if (isSignedIn) {
                    setTotalSelfNodes(totalSelfNodes);
                    setTotalSelfEarnings(totalSelfEarnings);
                    setTotalSelfBounties(totalSelfBounties);
                }
                setTotalBounties(totalBounties)
                setTotalPayouts(totalPayouts);
                setTotalNodes(totalNodes);
            })
        };
        const pollingInterval = setInterval(updateHomepage, 3000);
        return () => {
            clearInterval(pollingInterval);
        };
    }, [isSignedIn, totalNodes, totalSelfNodes, totalSelfEarnings, totalPayouts, totalSelfBounties, totalBounties]);

    return (
        <>
            {!isSignedIn ? (
                <Typography
                    variant="h5"
                    sx={{
                        textAlign: "center",
                    }}
                >
                    Please connect a wallet to continue
                </Typography>
            ) : (
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        margin: "auto",
                    }}
                >
                    <Paper
                        elevation={3}
                        sx={{
                            ...paperStyle,
                            background: "#388e3c",
                        }}
                    >
                        {/*                        <SvgIcon>*/}
                        {/*{NearLogo}*/}
                        {/*                        </SvgIcon>*/}
                        <MonetizationOnIcon sx={iconStyle}/>
                        <Typography variant="h5">My Earnings</Typography>
                        <Typography variant="h1">
                            <>
                                {Math.ceil(totalSelfEarnings/yoctoNear)}
                                <Typography>NEAR</Typography>
                            </>
                        </Typography>
                    </Paper>
                    <Paper
                        onClick={() => {
                            navigate("/bounty");
                        }}
                        elevation={3}
                        sx={{
                            ...paperStyle,
                            background: "#0288d1",
                            cursor: "pointer",
                        }}
                    >
                        <HistoryEduIcon sx={iconStyle}/>
                        <Typography variant="h5">My Bounties</Typography>
                        <Typography variant="h1">{totalSelfBounties}</Typography>
                    </Paper>
                    <Paper
                        onClick={() => {
                            navigate("/node");
                        }}
                        elevation={3}
                        sx={{
                            ...paperStyle,
                            background: "#ab47bc",
                            cursor: "pointer",
                        }}
                    >
                        <ComputerIcon sx={iconStyle}/>
                        <Typography variant="h5">My Nodes</Typography>
                        <Typography variant="h1">{totalSelfNodes}</Typography>
                    </Paper>
                </Box>
            )}
            <>
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        margin: "auto",
                    }}
                >
                    <Paper
                        elevation={3}
                        sx={{
                            ...paperStyle,
                            background: "rgb(38,38,38)",
                        }}
                    >
                        <MonetizationOnIcon sx={iconStyle}/>
                        <Typography variant="h5">Total Payouts</Typography>
                        <Typography variant="h1">
                            <>
                                {Math.ceil(totalPayouts / yoctoNear)}
                                <Typography>NEAR</Typography>
                            </>
                        </Typography>
                    </Paper>
                    <Paper
                        elevation={3}
                        sx={{
                            ...paperStyle,
                            background: "rgb(53,53,53)",
                        }}
                    >
                        <HistoryEduIcon sx={iconStyle}/>
                        <Typography variant="h5">Total Bounties</Typography>
                        <Typography variant="h1">{totalBounties}</Typography>
                    </Paper>
                    <Paper
                        elevation={3}
                        sx={{
                            ...paperStyle,
                            background: "rgb(68,68,68)",
                        }}
                    >
                        <ComputerIcon sx={iconStyle}/>
                        <Typography variant="h5">Total Nodes</Typography>
                        <Typography variant="h1">{totalNodes}</Typography>
                    </Paper>
                </Box>
            </>
            <Box>
                <img
                    style={{
                        marginTop: "24px",
                        height: "50px",
                        position: "absolute",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                    }}
                    src={NearBadge}
                />
            </Box>
        </>
    );
}
