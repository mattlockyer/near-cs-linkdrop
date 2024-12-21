import * as dotenv from 'dotenv';
dotenv.config();

// requires .env var TATUM_API_KEY
const dogeRpc = `https://api.tatum.io/v3/dogecoin`;

export const dogePost = (path, body) =>
    fetchJson(`${dogeRpc}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.TATUM_API_KEY,
        },
        body: JSON.stringify(body),
    });

const fetchJson = async (url, params = {}, noWarnings = false) => {
    let res;
    try {
        res = await fetch(url, params);
        if (res.status !== 200) {
            if (noWarnings) return;
            console.log('res error');
            console.log(await res.text());
            throw res;
        }
        return res.json();
    } catch (e) {
        if (noWarnings) return;
        console.log('fetchJson error', JSON.stringify(e));
    }
};
