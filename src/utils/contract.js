import { getDefaultNearAccount } from './near';

const { REACT_APP_contractId: contractId } = process.env;

export const tradeSignature = async (args) => {
    console.log('trade_signature call args', args);
    const account = getDefaultNearAccount();
    const res = await account.functionCall({
        contractId,
        methodName: 'trade_signature',
        args,
        gas: BigInt('300000000000000'),
    });
    return res;
};
