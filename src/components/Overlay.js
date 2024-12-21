import { wrap } from '../state/state';

const OverlayComp = ({ state, update }) => {
    const { msg = '' } = state;
    const active = msg.length !== 0;

    return (
        <div id="overlay" className={['overlay', active && 'active'].join(' ')}>
            <div className="container">
                {msg}

                <div className="close" onClick={() => update({ msg: '' })}>
                    ✖
                </div>
            </div>
        </div>
    );
};

export const Overlay = wrap(OverlayComp, ['overlay']);
