pragma circom 2.1.6;

include "circom-ecdsa/circuits/bigint.circom";

// multiplies two numbers stored using k n-bit registers
function multiply(a, b) {
    var n = 120; var k = 35; var kDouble = 70;
    var out[kDouble]; // last register should always be 0
    for (var i = 0; i < k; i++) {
        for (var j = 0; j < k; j++) {
            out[i+j] += a[i]*b[j];
        }
    }
    // puts array in canonical form
    for (var i = 0; i < 2*k-1; i++) {
        var carry = out[i] \ (2**n);
        out[i] -= carry*(2**n);
        out[i+1] += carry;
    }
    return out;
}

// checks if a > b, where a and b have k+1 n-bit registers
function greater(a, b) {
    var k = 35; var kPlusOne = 36;
    // comparisons[i] is 1 if the largest i-1 registers are equal and
    // a has a larger ith register, and is 0 otherwise
    var comparisons[kPlusOne];
    for (var i = 0; i < k+1; i++) {
        var result = 1;
        result *= (a[k-i] > b[k-i]);
        for (var j = k; j > k-i; j--) {
            result *= (a[j] == b[j]);
        }
        comparisons[i] = result;
    }
    
    var out = 1;
    for (var i = 0; i < k+1; i++) {
        out *= (1 - comparisons[i]);
    }
    return 1 - out;
}

// computes floor(a / b), where a has k+1 n-bit registers and b has k n-bit registers
// assumes that the floor is less than 2**n
function floor(a, b) {
    var n = 120; var k = 35; var kPlusOne = 36;
    var out = 0;
    // finds out via binary search
    for (var d = n-1; d >= 0; d--) {
        var prod[kPlusOne];
        // computes b * out
        for (var i = 0; i < k; i++) {
            prod[i] = (out + 2**d) * b[i];
        }
        // puts array in canonical form
        for (var i = 0; i < k; i++) {
            var carry = prod[i] \ (2**n);
            prod[i] -= carry*(2**n);
            prod[i+1] += carry;
        }
        // checks is product is less than a
        var prodLessThanOrEqualToA = 1 - greater(prod, a);
        out += prodLessThanOrEqualToA * (2**d);
    }
    return out;
}

// computes floor(a / b), where a has 2k-1 n-bit registers and b has k n-bit registers
// assumes that the floor is less than 2**(k*n)
// uses long division algorithm
function integerDivision(a, b) {
    var n = 120; var k = 35; var kPlusOne = 36;
    var q[k];
    var r[k];
    for (var i = k-1; i >= 0; i--) {
        var largestRegisters[kPlusOne];
        for (var j = 0; j < k+1; j++) {
            largestRegisters[j] = a[j+i];
        }
        // extract value of q[i]
        var qRegister = floor(largestRegisters, b);
        q[i] = qRegister;
        // subtract q[i] * b from a
        for (var j = 0; j < k; j++) {
            a[j+i] -= qRegister * b[j];
        }
        // return all carry bits
        for (var j = 0; j < 2*k-1; j++) {
            if (a[j] < 0) {
                var carry = (((-1 * a[j])-1) \ (2**n)) + 1;
                a[j] += carry * (2**n);
                a[j+1] -= carry;
            }
        }
    }
    for (var i = 0; i < k; i++) {
        r[i] = a[i];
    }
    return [q, r];
}

// checks that a has at most n bits
template HasNBits(n) {
    signal input in;
    signal aBits[n];
    signal inMod2ToN;
    signal output out;
    aBits <== Num2Bits(n)(in <== in);
    inMod2ToN <== Bits2Num(aBits);
    out <== IsEqual()(in <== [in, inMod2ToN]);
}

// multiplies two numbers a and b modulo m
// numbers are stored as k n-bit registers
template MultiplyMod(n, k) {
    // want to check that p(x) := a(x) * b(x) - m(x) * q(x) - c(x) is zero for x = 2^n
    // and that c has the correct range
    signal input a[k];
    signal input b[k];
    signal input m[k];
    signal q[k];
    signal output c[k];
    signal p[2*k-1];
    signal ab[2*k];
    signal mq[2*k];
    signal cRangeChecks[k];
    signal qRangeChecks[k];
    
    // determines c and q by first calculating a*b
    var aValues[k] = a;
    var bValues[k] = b;
    var abAnswer[2*k] = multiply(aValues, bValues);

    // performs the long division algorithm
    var cAnswer[k];
    var qAnswer[k];
    var divisionResult[2][k] = integerDivision(abAnswer, m);
    qAnswer = divisionResult[0];
    cAnswer = divisionResult[1];
    q <-- qAnswer;
    c <-- cAnswer;
    
    // determines p
    var pAnswer[2*k-1];
    for (var i = 0; i < k; i++) {
        for (var j = 0; j < k; j++) {
            pAnswer[i+j] += a[i]*b[j] - m[i]*q[j];
        }
    }
    for (var i = 0; i < k; i++) {
        pAnswer[i] -= c[i];
    }
    p <-- pAnswer;

    // checks that two degree-(2k-2) polynomials are equal by substituting 2k-1 points
    // specifically: p(x) = a(x) * b(x) - m(x) * q(x) - c(x)
    for (var x = 0; x < 2*k-1; x++) {
        var aEval;
        var bEval;
        var mEval;
        var qEval;
        var cEval;
        var pEval;
        for (var d = 0; d < k; d++) {
            aEval += (x**d) * a[d];
            bEval += (x**d) * b[d];
            mEval += (x**d) * m[d];
            qEval += (x**d) * q[d];
            cEval += (x**d) * c[d];
        }
        for (var d = 0; d < 2*k-1; d++) {
            pEval += (x**d) * p[d];
        }
        ab[x] <== aEval * bEval;
        mq[x] <== mEval * qEval;
        pEval === ab[x] - mq[x] - cEval;
    }

    // checks that p(2**n) = 0
    var pEval;
    for (var d = 0; d < 2*k-1; d++) {
        pEval += ((2**n)**d) * p[d];
    }
    pEval === 0;

    // range checks for c
    for (var i = 0; i < k; i++) {
        cRangeChecks[i] <== LessThan(n)(in <== [c[i], 2**n]);
        qRangeChecks[i] <== LessThan(n)(in <== [q[i], 2**n]);
        cRangeChecks[i] === 1;
        qRangeChecks[i] === 1;
    }
}

template Power65537(n, k) {
    signal input a[k];
    signal input m[k];
    signal powers[17][k];
    signal output b[k];
    powers[0] <== a;
    for (var i = 1; i < 17; i++) {
        powers[i] <== MultiplyMod(n, k)(a <== powers[i-1], b <== powers[i-1], m <== m);
    }
    b <== MultiplyMod(n, k)(a <== powers[0], b <== powers[16], m <== m);
}