import {expect, masque, suite, test, testasync} from './casualtesting.js';

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

suite("Numeric Expectations", () => {

    test("Greater Than", () => {
        expect(3).isGreaterThan(2);
    });

    test("Less Than", () => {
        expect(2).isLessThan(3);
    });

    test("Close To", () => {
        expect(0).isCloseTo(0);
        expect(0).isCloseTo(1e-4, 1e-3);
        expect(0).isCloseTo(1e-9, 1e-6);
    });
});

suite("Function Expectations", () => {

    test("To Throw", () => {
        const throwymcthrowface = () => {
            throw new Error("Totally expected and totally cool.");
        }
        expect(throwymcthrowface).toThrow();
    });

    test("To Throw a Specific Type", () => {
        class AVerySpecialErrorspode extends Error {}
        const throwymcthrowface = () => {
            throw new AVerySpecialErrorspode(
                "Totally expected and totally cool.")
        }
        expect(throwymcthrowface).toThrow(AVerySpecialErrorspode);
    });
});

suite("Masque Expectations", () => {

    test("Was Called", () => {
        var x = masque();
        x(); x();
        expect(x).wasCalled();
    });

    test("Was Not Called", () => {
        var x = masque();
        expect(x).wasNotCalled();
    });

    test("Was Called Once", () => {
        var x = masque();
        x();
        expect(x).wasCalledOnce();
    });

    test("Last Called With Args", () => {
        var x = masque();
        x('a');
        expect(x).lastCalledWithArgs('a');
        x('a', 10);
        expect(x).lastCalledWithArgs('a', 10);
    });
});
