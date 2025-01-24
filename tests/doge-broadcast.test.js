import test from 'ava';
import { dogePost } from './doge-utils.js';

test('broadcast doge tx', async (t) => {
    const explorer = 'https://blockexplorer.one/dogecoin/testnet';
    const body = {
        txData: `0100000001c3467b40448b0df53530309a76228515addf733994a17aff023053c8e6773461000000008b48304502210094741974ee7ef1802bfcb8e735917ac9a57b150e152a2093e4e6c12877b8f7ea022041b2a519dcff998abde6b935a7b49f00f0f83bdfb2e066c453cc3c212c11868a014104a5bae52102176371f6afbb057113a7bd661babf2b87cc49fa5d5070ee8717cec76d4eaa47af6d1c47d06d770c434364b7265c0ffdcd279148269a026620ff2d9ffffffff0200e1f505000000004104a5bae52102176371f6afbb057113a7bd661babf2b87cc49fa5d5070ee8717cec76d4eaa47af6d1c47d06d770c434364b7265c0ffdcd279148269a026620ff2d9920ea235000000004104a5bae52102176371f6afbb057113a7bd661babf2b87cc49fa5d5070ee8717cec76d4eaa47af6d1c47d06d770c434364b7265c0ffdcd279148269a026620ff2d900000000`,
    };
    const res = await dogePost(`/broadcast`, body);
    const hash = res.txId;
    console.log('tx hash', hash);
    console.log('explorer link', `${explorer}/tx/${hash}`);
    t.pass();
});
