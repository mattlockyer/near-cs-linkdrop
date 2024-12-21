import { wrap } from './state/state';
import { Overlay } from './components/Overlay';
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
