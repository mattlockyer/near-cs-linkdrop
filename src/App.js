import { wrap } from './state/state';
import { Overlay } from './components/Overlay';
import { contractId, setAccessKey, contractCall } from './utils/near-provider';
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

                            // TODO: for legacy P2PKH we need to get the receiver's public key
                            // Option 1 - ask them to sign with wallet and recover public key
                            // Option 2 - use wallet API e.g. OKX Wallet and recover public key

                            setAccessKey(secretKey);

                            // await contractCall({
                            //     accountId: contractId,
                            //     methodName: 'claim',
                            //     contractId,
                            //     args: {
                            //         txid_str: 'UTXO_TXID_HEX_STRING',
                            //         vout: 0, // vout of UTXO
                            //         receiver:
                            //             'UNCOMPRESSED_PUBLIC_KEY_OF_RECEIVING_ACCOUNT',
                            //         change: // any change of tx
                            //     },
                            // });
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
