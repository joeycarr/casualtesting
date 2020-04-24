import {expect, suite, test, testasync} from './casualtesting.js';

suite("Basic expectations", () => {

    test("Equality", () => {
        expect(2).equals(2);
        expect("string").equals("string");
        expect(null).equals(undefined);
    });

    test("Strict Equality", () => {
        expect(2).is(2);
        expect("string").is("string");
        expect(null).is(null);
        expect(undefined).is(undefined);
    });

    test("Instance Of", () => {
        expect({"key": "value"}).isInstanceOf(Object);
        expect(['a', 'b', 'c']).isInstanceOf(Object);
        expect(['a', 'b', 'c']).isInstanceOf(Array);
        expect(new Error).isInstanceOf(Error);
    });

});
