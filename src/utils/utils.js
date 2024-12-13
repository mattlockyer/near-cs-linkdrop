export const fetchJson = async (url, params = {}, noWarnings = false) => {
    let res;
    try {
        res = await fetch(url, params);
        if (res.status !== 200) {
            if (noWarnings) return;
            console.log('res error');
            console.log(res);
            throw res;
        }
        return res.json();
    } catch (e) {
        if (noWarnings) return;
        console.log('fetchJson error', JSON.stringify(e));
    }
};

export const convertBitcoin = (value, toUnit) => {
    if (toUnit === 'btc') {
        // Convert satoshis to bitcoins and return as a string with fixed precision
        return (value / 100000000).toFixed(8).toString();
    } else if (toUnit === 'sats') {
        // Convert bitcoins to satoshis and return as a string
        return (value * 100000000).toString();
    } else {
        throw new Error(
            'Invalid unit specified. Use "btc" for bitcoins or "sats" for satoshis.',
        );
    }
};
