import { wrap } from './state/state';
import { Overlay } from './components/Overlay';
import {
    MPC_PATH,
    MPC_PUBLIC_KEY,
    setAccessKey,
    contractCall,
} from './utils/near-provider';
import { generateAddress } from './utils/kdf';
import { getChange } from './utils/bitcoin';
import './styles/app.scss';

const AppComp = ({ state, update }) => {
    const query = window.location.href.split('?')[1];
    const params = query ? new URLSearchParams(query) : null;
    const contractId = params ? params.get('contractId') : null;
    const secretKey = params ? params.get('secretKey') : null;

    const { address = '' } = state.app;

    return (
        <>
            <Overlay />
            <div className="container-fluid center">
                <section>
                    <h4>You Received a LinkDrop</h4>
                    <p>Enter your address to send the asset to your account.</p>
                </section>

                <section>
                    <input
                        placeholder="bc1..."
                        value={address}
                        onChange={(e) => update({ address: e.target.value })}
                    />
                </section>

                <section>
                    <button
                        className="btn btn-primary"
                        onClick={async () => {
                            console.log('claim to', address);

                            setAccessKey(secretKey);

                            const DROP_SATS = 546;
                            let funderAddress = null;
                            let funderBalance = null;
                            let funderTxId = null;
                            let dropChange = null;

                            const { address, publicKey } =
                                await generateAddress({
                                    publicKey: MPC_PUBLIC_KEY,
                                    accountId: contractId,
                                    path: MPC_PATH,
                                    chain: 'bitcoin',
                                });

                            console.log('funderAddress', address);
                            console.log('funderPublicKey', publicKey);
                            funderAddress = address;
                            funderPublicKey = publicKey;

                            funderBalance = await getBalance({
                                address: funderAddress,
                            });
                            console.log(`funder balance ${funderBalance}`);

                            const utxos = await getBalance({
                                address: funderAddress,
                                getUtxos: true,
                            });
                            funderTxId = utxos[0].txid;

                            dropChange = await getChange({
                                balance: funderBalance,
                                sats: DROP_SATS,
                            });
                            console.log('drop change', dropChange);

                            await contractCall({
                                accountId: contractId,
                                methodName: 'claim',
                                contractId,
                                args: {
                                    txid_str: funderTxId,
                                    vout: 0,
                                    receiver: funderAddress,
                                    change: dropChange.toString(),
                                },
                            });
                        }}
                    >
                        Claim
                    </button>
                </section>
            </div>
        </>
    );
};

export const App = wrap(AppComp, ['app', 'overlay']);
