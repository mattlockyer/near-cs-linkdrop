import { useState, memo } from 'react';
import { initState } from './init';

const GLOBAL_STATE_KEY = '__GLOBAL__';
const TYPEOF_NUMBER = 'number';
const TYPEOF_OBJECT = 'object';
const config = {
    DEEP_COMPARE: true,
};

// TODO move to own file

let globalState = initState;

const getStateForKeys = (keys) => {
    let state = {};
    if (keys.length > 1) {
        keys.forEach((key) => (state[key] = getState(key)));
    } else {
        state = getState(keys[0]);
    }
    return state;
};

export const wrap = (Component, keys) => {
    if (!keys) keys = [GLOBAL_STATE_KEY];
    if (typeof keys === 'string') keys = [keys];
    if (!keys[0]) keys[0] = GLOBAL_STATE_KEY;

    const initState = getStateForKeys(keys);

    const { name } = Component;
    let init = true;
    const wrapped = (props) => {
        const [state, update] = useState(initState);

        const _update = () => {
            const state = getStateForKeys(keys);
            update(state);
        };

        if (init) {
            init = false;
            subscribe(name, keys, _update);
        }
        return (
            <Component
                {...{
                    ...props,
                    state,
                    update: updateState(keys),
                }}
            />
        );
    };
    return memo(wrapped);
};

const updateState = (keys) => (newState, where) => {
    // no update key provided, default to first one, should be highest up the tree
    // console.log(keys, newState, where, updatesByKey)
    if (!where) {
        where = 0;
    }

    // if key is string not number, find it's index
    let key;
    if (typeof where === TYPEOF_NUMBER) {
        key = keys[where];
    } else {
        const whereIndex = keys.findIndex((k) => k === where);
        // couldn't find the string in the component keys
        if (whereIndex === -1) {
            if (!updatesByKey[where]) {
                return console.warn('Cannot find key to update state');
            }
            key = where;
        } else {
            key = keys[whereIndex];
        }
    }

    if (config.DEEP_COMPARE) {
        // check state against newState, if equal avoid unneccessary updates and re-renders for all components
        if (!shouldUpdate(getState(key), newState)) {
            return console.log('DEEP_COMPARE: nothing to update');
        }
    }

    globalState = deepCopy(globalState, key, newState);
    const state = getState(key);
    const updates = updatesByKey[key];
    for (let i = 0; i < updates.length; i++) {
        updates[i](state);
    }
};

// helpers

const updates = {};
const updatesByKey = {};
const subscribe = (name, keys, update) => {
    if (!updates[name]) {
        updates[name] = {
            keys,
            update,
        };
    } else {
        // maybe subscribe later?
        updates[name].keys.push(...keys);
    }
    // updates by key for lookup
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!updatesByKey[key]) updatesByKey[key] = [];
        updatesByKey[key].push(update);
    }
};

const getState = (key) => {
    if (key === GLOBAL_STATE_KEY) return globalState;
    const split = key.split('.');
    let state = globalState;
    for (let i = 0; i < split.length; i++) {
        state = state[split[i]];
    }
    return state;
};

const deepCopy = (state, key, newState) => {
    if (key === GLOBAL_STATE_KEY) {
        return { ...globalState, ...newState };
    }
    // traverse globalState and merge newState over state and return new globalState
    const entries = Object.entries(state);
    const split = key.split('.');
    const ret = {};
    for (let i = 0; i < entries.length; i++) {
        const [k, v] = entries[i];
        if (split[0] === k) {
            split.shift();
            if (split.length > 0) {
                ret[k] = deepCopy(v, split.join('.'), newState);
            } else {
                ret[k] = { ...v, ...newState };
            }
        } else {
            ret[k] = v;
        }
    }
    return ret;
};

const shouldUpdate = (state, newState) => {
    const newStateEntries = Object.entries(newState);
    for (let i = 0; i < newStateEntries.length; i++) {
        const [k, v2] = newStateEntries[i];
        const v = state[k];
        // there's nothing for this key on the original state obj
        if (!v || !v2) {
            return true;
        }
        if (typeof v2 === TYPEOF_OBJECT) {
            if (Array.isArray(v2)) {
                // value of diff type or array of diff length is overwritten by new array
                if (!Array.isArray(v) || v.length !== v2.length) {
                    return true;
                }
                // array values must have same order
                for (let j = 0; j < v.length; j++) {
                    if (v[j] !== v2[j]) {
                        return true;
                    }
                }
            }
            // byte arrays must have same order
            if (v.byteLength && v2.byteLength) {
                for (let i = 0; i < v2.length; i++) {
                    if (v[i] !== v2[i]) {
                        return true;
                    }
                }
                return false;
            }
            // recursively compare any other objects
            return shouldUpdate(v, v2);
        }
        // non-object values, strict type comparison
        if (v !== v2) {
            return true;
        }
    }
    return false;
};
