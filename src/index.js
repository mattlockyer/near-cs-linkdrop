import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('app');
const root = createRoot(container);
root.render(
    <>
        <div className="container">
            <center style={{ marginTop: 32 }}>
                <App />
            </center>
        </div>
    </>,
);
