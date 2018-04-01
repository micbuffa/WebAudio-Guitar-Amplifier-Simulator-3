// maps a value from [istart, istop] into [ostart, ostop]
function map(value, istart, istop, ostart, ostop) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
}

// utils functions for some waveshapers
function tanh(n) {
    return (Math.exp(n) - Math.exp(-n)) / (Math.exp(n) + Math.exp(-n));
}

function sign(x) {
    if (x === 0) {
        return 1;
    } else {
        return Math.abs(x) / x;
    }
}
