import { wrap } from '../state/state';
import { Overlay } from '../components/Overlay';
import { sleep } from '../state/utils';
import { transactions } from '../utils/transactions';

const BitcoinComp = ({ state, update, destination }) => {
    const updateOverlay = (msg) => update(msg, 'overlay');

    const { step, txString, pk, address, derivedAddress, balance } = state;

    const transaction = transactions[destination];

    switch (step) {
        case 'connect':
            return (
                <>
                    <Overlay />
                    <h4>Connect BTC Wallet</h4>
                    <button
                        onClick={async () => {
                            if (typeof okxwallet === 'undefined') {
                                console.log('hello');
                                updateOverlay({
                                    overlayMessage:
                                        'Please install or enable OKX Wallet extension',
                                });
                                await sleep(1500);
                                updateOverlay({
                                    overlayMessage: '',
                                });
                                return;
                            }

                            const res = await okxwallet.bitcoin.connect();
                            if (!res.address) {
                                updateOverlay({
                                    overlayMessage:
                                        'Please accept the connection',
                                });
                                await sleep(1500);
                                updateOverlay({
                                    overlayMessage: '',
                                });
                            }
                            const { address, publicKey } = res;

                            const { derivedAddress, balance, tx } =
                                await transaction.getTransaction({
                                    path: publicKey,
                                    updateOverlay,
                                });

                            update({
                                txString: JSON.stringify(tx, undefined, 4),
                                address,
                                derivedAddress,
                                balance,
                                pk: publicKey,
                                step: 'sign',
                            });
                        }}
                    >
                        Connect
                    </button>
                </>
            );
        case 'sign':
            return (
                <>
                    <Overlay />
                    <h4>Sign Message</h4>
                    <textarea
                        rows={16}
                        cols={120}
                        value={txString}
                        onChange={(e) => update({ txString: e.target.value })}
                    ></textarea>
                    <br />
                    <p>Signing Wallet: {address || pk}</p>
                    <p>Sending Address: {derivedAddress}</p>
                    <p>Sending Address Balance: {balance}</p>
                    <button
                        onClick={async () => {
                            updateOverlay({
                                overlayMessage: 'Please sign TX in OKX Wallet',
                            });
                            const json = JSON.parse(txString);
                            let sig;
                            try {
                                sig =
                                    await window.okxwallet.bitcoin.signMessage(
                                        JSON.stringify(json),
                                        'ecdsa',
                                    );
                            } catch (e) {
                                if (/denied/.test(JSON.stringify(e))) {
                                    updateOverlay({
                                        overlayMessage:
                                            'Rejected signature in OKX Wallet',
                                    });
                                    await sleep(3000);
                                    updateOverlay({
                                        overlayMessage: '',
                                    });
                                    return;
                                }
                                console.error(e);
                            }

                            transaction.completeTx({
                                args: {
                                    owner: pk,
                                    msg: JSON.stringify(json),
                                    sig,
                                    source: 'bitcoin',
                                    destination,
                                },
                                updateOverlay,
                                jsonTx: json,
                            });
                        }}
                    >
                        Sign
                    </button>
                </>
            );
    }
};

export const Bitcoin = wrap(BitcoinComp, ['bitcoin', 'overlay']);
