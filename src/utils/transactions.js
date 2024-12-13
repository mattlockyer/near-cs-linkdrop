import { getBitcoinTx, completeBitcoinTx } from './bitcoin';
import { getEvmTx, completeEvmTx } from './evm';
import { getNearTx, completeNearTx } from './near';

export const transactions = {
    bitcoin: {
        getTransaction: getBitcoinTx,
        completeTx: completeBitcoinTx,
    },
    evm: {
        getTransaction: getEvmTx,
        completeTx: completeEvmTx,
    },
    near: {
        getTransaction: getNearTx,
        completeTx: completeNearTx,
    },
};
