import { wrap } from './state/state';
import './styles/app.scss';

const AppComp = ({ state, update }) => {
    console.log(state);

    return (
        <div className="container-fluid">
            <h1>Hello World</h1>
        </div>
    );
};

export const App = wrap(AppComp, ['app']);
