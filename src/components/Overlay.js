import { wrap } from '../state/state';

const OverlayComp = ({ state, update }) => {
    const { overlayMessage = '' } = state;

    const active = overlayMessage.length !== 0;

    return (
        <div id="overlay" className={['overlay', active && 'active'].join(' ')}>
            <div className="container">
                <center style={{ marginTop: 128 }}>
                    <div
                        style={{
                            background: 'white',
                            width: '600px',
                            padding: 32,
                            borderRadius: 16,
                            boxShadow: '0 0 32px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        <h4>{overlayMessage}</h4>
                    </div>
                </center>
            </div>
        </div>
    );
};

export const Overlay = wrap(OverlayComp, ['overlay']);
