
export const log = {
    info: console.log,
    error: console.error
};

// We only raise TestErrors when tests fail. Normal Error instances represent a
// flaw in the test framework or the test code. TestErrors are always trapped
// by the test and testasync functions.
export class TestError extends Error { }

/**
 * Execute one test case.
 * @param {string} label - The label for the test to indicate success or failure
 * in the output.
 * @param {function} fn - The test case itself.
 */
export const test = (label, fn) => {
    const meta = currentsuite;

    meta.attempts++;
    try {
        fn();
        meta.passed++;
        meta.info(`\tPASS:\t${label}`);
    } catch(error) {
        meta.failed++;
        if(error instanceof TestError) {
            meta.error(`\tFAIL:\t${label}`);
            meta.error(error);
        } else {
            meta.error(`\tTEST CODE FAILURE:\t${label}`);
            meta.info('\tThis test failed due to an unexpected bug or a flaw in the test code, not due to a failed test expectation.')
            meta.error(error);
        }
    }
}

/**
 * Execute one test case asynchronously.
 * @param {string} label - The label for the test to indicate success or failure
 * in the output.
 * @param {function} asyncfn - The test case itself. This function should be
 * declared async or it should return a Promise.
 */
export const testasync = (label, asyncfn) => {
    const meta = currentsuite;

    meta.attempts++;
    var promise = asyncfn();
    meta.asynctests.push(promise);
    promise.then(() => {
        meta.passed++;
        meta.info(`\tPASS:\t${label}`)
    });
    promise.catch((error) => {
        meta.failed++;
        if(error instanceof TestError) {
            meta.error(`\tFAIL:\t${label}`);
            meta.error(error);
        } else {
            meta.error(`\tTEST CODE FAILURE:\t${label}`);
            meta.info('\tThis test failed due to an unexpected bug or a flaw in the test code, not due to a failed test expectation.')
            meta.error(error);
        }
    });
}

// This is a module private variable used for coordinating counting between
// the test cases and the suite wrapper function.
var currentsuite;

class Suite {
    constructor() {
        this.asynctests = new Array();
        this.attempts = 0;
        this.passed = 0;
        this.failed = 0;

        this.messages = new Array();
    }

    info(...args) {
        this.messages.push({type: "info", "args": args});
    }

    error(...args) {
        this.messages.push({type: "error", "args": args});
    }

    report() {
        for(let {type, args} of this.messages) {
            console[type](...args);
        }
    }
}

/**
 * Execute a suite of tests and report the results. Individual tests can be run
 * outside of a suite, but they won't contribute to reported counts of attempts,
 * passes, or failures.
 * @param {string} label - The label for the whole suite to distinguish it from
 * other test files that may be run simultaneously.
 * @param {function} fn - A wrapper function around all the individual calls to
 * the test and testasync functions.
 */
export const suite = async (label, fn) => {
    const meta = currentsuite = new Suite();

    meta.info(`Starting "${label}" suite`);

    fn();

    await Promise.allSettled(meta.asynctests);
    meta.info(`Results for "${label}" suite`);
    meta.info(`${meta.passed}/${meta.attempts} tests passed. ${meta.failed} tests failed`);
    meta.info("---------------");
    meta.report();
}

// ---------
//  Masques
// ---------

/**
 * A masque wraps a normal inner function and monitors its behavior. This
 * provides a mechanism for testing functions that get passed to event handlers
 * or callbacks or testing the event systems or back-callers themselves.
 * @param {function|Symbol} fn - Typically you'll pass the function you want to
 * wrap. The resulting masque will behave exactly like fn, except it will also
 * log all of its arguments and results every time it is called. The Expectation
 * class uses the special symbol `masque.memos` to interrogate the masque
 * closure for the contained log of arguments, results, and exceptions.
 * @returns {function} - The wrapper around fn.
 */
export const masque = (fn) => {
    var memos = new Array();
    if(!fn) fn = () => {};
    const wrapper = (...args) => {
        if(args.length == 1 && args[0] == masque.memos) {
            return memos;
        }

        let memo = { args: args };
        memos.push(memo);
        try {
            memo.result = fn(...args);
        } catch(error) {
            memo.error = error;
            throw error;
        }
        return memo.result;
    }
    wrapper.sigil = masque.sigil;
    return wrapper;
}

masque.memos = Symbol('masque.memos');
masque.sigil = Symbol('masque.sigil');

// --------------
//  Expectations
// --------------

/**
 * @param {*} value - A value of any type
 * @returns {Expectation} - An Expectation instance that you can interrogate.
 */
export const expect = (value) => {
    switch(typeof(value)) {
        case "number":
            return new NumericExpectation(value);
        case "function":
            if(value.sigil == masque.sigil)
                return new MasqueExpectation(value);
            else
                return new FunctionExpectation(value);
        case "object":
            if(value instanceof Array)
                return new ArrayExpectation(value);
            if(value instanceof Set)
                return new SetExpectation(value);
            // otherwise we fall through to the default case
        default:
            return new Expectation(value);
    }
}

class Expectation {
    constructor(value) {
        this.value = value;
    }

    equals(other) {
        if(this.value != other) {
            throw new TestError(`${this.value} != ${other}`);
        }
        return this;
    }

    is(other) {
        if(this.value !== other) {
            throw new TestError(`${this.value} !== ${other}`);
        }
        return this;
    }

    isNot(other) {
        if(this.value === other) {
            throw new TestError(`${this.value} === ${other}`);
        }
        return this;
    }

    isInstanceOf(type) {
        if(!(this.value instanceof type)) {
            throw new TestError(`Expected value is instance of "${this.value.constructor.name}", but expected "${type.name}"`);
        }
        return this;
    }

    yields(count) {
        let i = 0;
        for(let item of this.value) {
            if(i > count) throw new TestError(`Value yielded more than ${count} items.`);
            i++;
        }
        if(i < count) throw new TestError(`Value yielded only ${i} items of an expected ${count}`);
    }
}

class ArrayExpectation extends Expectation {
    typecheck(other) {
        if(! (other instanceof Array)) {
            throw new Error(`The value "${other}" is not an Array`);
        }
    }

    allEqual(other) {
        this.typecheck(other);

        if(this.value.length != other.length) {
            throw new TestError(`The arrays have different lengths; expected an array of length ${other.length} but found an array of length ${this.value.length}`);
        }
        const len = this.value.length;
        for(let i=0; i < len; i++) {
            let a = this.value[i];
            let b = other[i];
            if( a != b ) {
                throw new TestError(`The array values differ at index ${i} (${a} != ${b})`);
            }
        }
    }
}

class FunctionExpectation extends Expectation {
    typecheck() {
        if(typeof(this.value) != 'function')
            throw new Error(`The value, "${this.value}", is not a function`);
    }

    toThrow(ExpectedError=Error) {
        try {
            this.value();
            throw new TestError('Expected function to throw an error, but it did not.')
        } catch(error) {
            if(error instanceof TestError) {
                throw error;
            }
            if(!(error instanceof ExpectedError)) {
                throw new TestError(`Expected an exception of type ${type.name}, but caught an error with type ${error.constructor.name}`)
            }
        }
        return this;
    }
}

class MasqueExpectation extends FunctionExpectation {

    typecheck() {
        super.typecheck();
        if(this.value.sigil != masque.sigil)
            throw new Error(
                `The value, "${this.value}", is not a masque function`);
        return this;
    }

    wasCalled() {
        this.typecheck();
        if(this.value(masque.memos).length < 1)
            throw new TestError('The function was never called.');
        return this;
    }

    wasCalledOnce() {
        this.typecheck();
        if(this.value(masque.memos).length != 1)
            throw new TestError('The function should have been called one time.');
        return this;
    }

    wasNotCalled() {
        this.typecheck();
        if(this.value(masque.memos).length > 0)
            throw new TestError('The function should not have been called.')
        return this;
    }

    lastCalledWithArgs(...args) {
        this.typecheck();
        var memos = this.value(masque.memos);
        if(memos.length < 1) {
            throw new TestError('The function was never called.');
        }
        var last = memos.pop();
        if(args.length != last.args.length) {
            throw new TestError(`Argument list lengths to not match: got ${JSON.stringify(last.args)} but expected ${JSON.stringify(args)}`);
        }
        var len = args.length;
        for(let i=0; i<len; i++) {
            if(last.args[i] != args[i]) {
                throw new TestError(`Argument value at index ${i} does not match: got ${JSON.stringify(last.args)} but expected ${JSON.stringify(args)}`);
            }
        }
        return this;
    }
}

class NumericExpectation extends Expectation {
    typecheck(other) {
        if(typeof(other) != 'number')
            throw new Error(`The argument, "${other}", is not a number and can't be compared with the value of the expectation`);
    }

    isGreaterThan(other) {
        this.typecheck(other);
        if(this.value <= other)
            throw new TestError(`${this.value} is not greater than ${other}`);
        return this;
    }

    isLessThan(other) {
        this.typecheck(other);
        if(this.value >= other)
            throw new TestError(`${this.value} is not less than ${other}`);
        return this;
    }

    isCloseTo(other, precision=1e-3) {
        this.typecheck(other);
        if(Math.abs(this.value - other) > precision)
            throw new TestError(`${this.value} and ${other} are different by more than ${precision}`)
        return this;
    }
}

class SetExpectation extends Expectation {
    typecheck(other) {
        if(! (other instanceof Set)) {
            throw new Error(`The argument, "${other}", is not a Set.`);
        }
    }

    has(item) {
        if(! this.value.has(item))
            throw new TestError(`Set does not include ${item}`);
    }
}
