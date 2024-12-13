import { wrap } from './state/state';
import { Bitcoin } from './components/Bitcoin';
import { Evm } from './components/Evm';
import './styles/app.scss';

const AppComp = ({ state, update }) => {
    const { source, destination } = state;

    switch (source) {
        case 'bitcoin':
            return <Bitcoin destination={destination} />;
        case 'evm':
            return <Evm destination={destination} />;
        default:
            return destination ? (
                <>
                    <h4>Choose Signing Wallet</h4>
                    <br />
                    <button onClick={() => update({ source: 'bitcoin' })}>
                        Bitcoin (OKX Wallet)
                    </button>
                    <br />
                    <br />
                    <button onClick={() => update({ source: 'evm' })}>
                        EVM (MM or OKX Wallet)
                    </button>
                </>
            ) : (
                <>
                    <h4>Choose the Transaction to Execute</h4>
                    <br />
                    <button onClick={() => update({ destination: 'bitcoin' })}>
                        Bitcoin
                    </button>
                    <br />
                    <br />
                    <button onClick={() => update({ destination: 'near' })}>
                        NEAR
                    </button>
                    <br />
                    <br />
                    <button onClick={() => update({ destination: 'evm' })}>
                        EVM
                    </button>
                </>
            );
    }
};

export const App = wrap(AppComp, ['app']);
