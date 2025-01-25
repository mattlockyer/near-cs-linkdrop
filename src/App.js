import { wrap } from './state/state';
import { Overlay } from './components/Overlay';
import {
    MPC_PATH,
    MPC_PUBLIC_KEY,
    setAccessKey,
    contractCall,
} from './utils/near-provider';
import { generateAddress } from './utils/kdf';
import { broadcast, getChange, getBalance } from './utils/bitcoin';
import './styles/app.scss';

const AppComp = ({ state, update }) => {
    const query = window.location.href.split('?')[1];
    const params = query ? new URLSearchParams(query) : null;
    const contractId = params ? params.get('contractId') : null;
    const secretKey = params ? params.get('secretKey') : null;
    const from = params ? params.get('from') : null;

    const { address = 'mwVgE7n7nwtc3TtTDxN8c2gntFtVpBwBtK' } = state.app;

    return (
        <>
            <Overlay />
            <div className="container-fluid center">
                <section>
                    <h4>
                        You Received a LinkDrop{from ? ` from ${from}` : ''}
                    </h4>
                    <p>Enter your address to send the asset to your account.</p>
                </section>

                <section className="input">
                    <input
                        className="form-control"
                        placeholder="bc1..."
                        value={address}
                        onChange={(e) =>
                            update({ address: e.target.value }, 'app')
                        }
                    />
                </section>

                <section>
                    <button
                        className="btn btn-primary"
                        onClick={async () => {
                            update(
                                { msg: 'claiming to ' + address },
                                'overlay',
                            );

                            const isSet = await setAccessKey(secretKey);
                            if (!isSet) {
                                window.alert('link is invalid or already used');
                                update({ msg: '' }, 'overlay');
                                return;
                            }

                            const DROP_SATS = 546;
                            let funderBalance = null;
                            let funderTxId = null;
                            let dropChange = null;

                            const { address: funderAddress } =
                                await generateAddress({
                                    publicKey: MPC_PUBLIC_KEY,
                                    accountId: contractId,
                                    path: MPC_PATH,
                                    chain: 'bitcoin',
                                });
                            funderBalance = await getBalance({
                                address: funderAddress,
                            });

                            const utxos = await getBalance({
                                address: funderAddress,
                                getUtxos: true,
                            });
                            funderTxId = utxos[0].txid;

                            dropChange = await getChange({
                                balance: funderBalance,
                                sats: DROP_SATS,
                            });

                            console.log('claimingAddress', address);
                            console.log('funderAddress', funderAddress);
                            console.log('funderTxId', funderTxId);
                            console.log(`funderBalance ${funderBalance}`);
                            console.log('dropChange', dropChange);

                            if (!window.confirm('continue?')) return;

                            update(
                                { msg: 'waiting for NEAR signature' },
                                'overlay',
                            );

                            const res = await contractCall({
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

                            console.log('signedrawtx', res);

                            update(
                                { msg: 'broadcasting to Bitcoin network' },
                                'overlay',
                            );

                            const res2 = await broadcast(res);
                            update(
                                { msg: 'broadcasting to Bitcoin network' },
                                'overlay',
                            );

                            console.log('broadcast hash', res2);

                            update({ msg: '' }, 'overlay');
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
