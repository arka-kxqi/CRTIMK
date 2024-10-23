import "regenerator-runtime/runtime";
import React, {useEffect} from "react";
import NavBar from "./common/nav-bar";
import Home from "./home/home";
import Bounty from "./bounty/bounty";
import Node from "./node/node";
import {Wallet} from "./common/near-wallet";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {NodeDetail} from "./node/node-detail";
import {ErrorBoundary} from "react-error-boundary";
import {TransientStorage} from "./storage";
import {atom, useRecoilState} from "recoil";
import {BountyDetail} from "./bounty/bounty-detail";

export const COORDINATOR_ID = process.env.CONTRACT_NAME || process.env.COORDINATOR_ID || "dev-1669007152167-60003371065013";
export const ONE_YOCTO_NEAR = 10**24;

export const localStorageState = atom<TransientStorage>({
    key: "localStorageState",
    default: new TransientStorage(),
});
export const isSignedInState = atom<boolean>({
    key: "isSignedInState",
    default: false,
})

export const WalletContext = React.createContext<Wallet>(null);
export default function App({
                                isSignedIn,
                                wallet,
                            }: {
    isSignedIn: boolean;
    wallet: Wallet;
}) {

    const [localIsSignedIn, setLocalIsSignedInState] = useRecoilState(isSignedInState);
    useEffect(() => {
        if(isSignedIn !== localIsSignedIn) {
            setLocalIsSignedInState(isSignedIn);
        }
    }, [isSignedIn, wallet])

    return (
        <ErrorBoundary
            fallbackRender={({error, resetErrorBoundary}) => (
                <div role="alert">
                    Something went wrong:
                    <pre>{error.message}</pre>
                    <button onClick={resetErrorBoundary}>Try again</button>
                </div>
            )}
        >
            <WalletContext.Provider value={wallet}>
                <BrowserRouter>
                    <NavBar isSignedIn={isSignedIn}/>
                    <main
                        style={{
                            maxWidth: "1536px",
                            paddingLeft: "24px",
                            paddingRight: "24px",
                            marginLeft: "auto",
                            marginRight: "auto",
                            paddingTop: "24px",
                        }}
                    >
                        <React.Suspense fallback={<div>Loading...</div>}>
                            <Routes>
                                <Route path="/" element={<Home isSignedIn={isSignedIn}/>}/>
                                <Route path="/bounty" element={<Bounty/>}/>
                                <Route path="/bounty/:id" element={<BountyDetail/>}/>
                                <Route path="/node/:id" element={<NodeDetail/>}/>
                                <Route path="/node" element={<Node/>}/>
                            </Routes>
                        </React.Suspense>
                    </main>
                </BrowserRouter>
            </WalletContext.Provider>
        </ErrorBoundary>
    );
}

