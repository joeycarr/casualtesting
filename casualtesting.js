var asynctests = new Array();
var attempts = 0;
var passed = 0;
var failed = 0;

export const log = {
    info: console.log,
    error: console.error
};

// We only raise TestErrors when tests fail. Normal Error instances represent a
// flaw in the test framework or the test code.
class TestError extends Error { }

/**
 * Execute one test case.
 * @param {string} label - The label for the test to indicate success or failure
 * in the output.
 * @param {function} fn - The test case itself.
 */
export const test = (label, fn) => {
    attempts++;
    try {
        fn();
        passed++;
        log.info(`\tPASS:\t${label}`);
    } catch(error) {
        failed++;
        if(error instanceof TestError) {
            log.error(`\tFAIL:\t${label}`);
            log.error(error);
        } else {
            log.error(`\tTEST CODE FAILURE:\t${label}`);
            log.info('\tThis test failed due to an unexpected bug or a flaw in the test code, not due to a failed test expectation.')
            log.error(error);
        }    }
}

/**
 * Execute one test case asynchronously.
 * @param {string} label - The label for the test to indicate success or failure
 * in the output.
 * @param {function} asyncfn - The test case itself. This function should be
 * declared async or it should return a Promise.
 */
export const testasync = (label, asyncfn) => {
    attempts++;
    var promise = asyncfn();
    asynctests.push(promise);
    promise.then(() => {
        passed++;
        log.info(`\tPASS:\t${label}`)
    });
    promise.catch((error) => {
        failed++;
        if(error instanceof TestError) {
            log.error(`\tFAIL:\t${label}`);
            log.error(error);
        } else {
            log.error(`\tTEST CODE FAILURE:\t${label}`);
            log.info('\tThis test failed due to an unexpected bug or a flaw in the test code, not due to a failed test expectation.')
            log.error(error);
        }
    });
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
    asynctests = new Array();
    attempts = 0;
    passed = 0;
    failed = 0;

    log.info(`Starting "${label}" suite`)

    fn();

    await Promise.allSettled(asynctests);
    log.info(`Results for "${label}" suite`);
    log.info(`${passed}/${attempts} tests passed. ${failed} tests failed`);
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

    isInstanceOf(type) {
        if(!(this.value instanceof type)) {
            throw new TestError(`Expected value is instance of "${this.value.constructor.name}", but expected ${type.name}`);
        }
        return this;
    }
}

class FunctionExpectation extends Expectation {
    typecheck() {
        if(typeof(this.value) != 'function')
            throw new TestError(`The value, "${this.value}", is not a function`);
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
            throw new TestError(
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
    typecheck() {

    }

    greaterThan(other) {
        this.typecheck();
        if(this.value <= other)
            throw new TestError(`${this.value} is not greater than ${other}`);
        return this;
    }

    lessThan(other) {
        this.typecheck();
        if(this.value >= other)
            throw new TestError(`${this.value} is not less than ${other}`);
        return this;
    }

    closeTo(other, precision=1e-3) {
        this.typecheck();
        if(Math.abs(this.value - other.value) > precision)
            throw new TestError(`${this.value} and ${other} are different by more than ${precision}`)
        return this;
    }
}
