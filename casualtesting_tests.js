import {expect, suite, test, testasync} from './casualtesting.js';

suite("Basic expectations", () => {

    test("Equality", () => {
        expect(2).equals(2);
        expect("string").equals("string");
        expect(null).equals(undefined);
    });

});
