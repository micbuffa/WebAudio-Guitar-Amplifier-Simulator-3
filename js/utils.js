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

// Loads a sample and decode it using ES6 new syntax
// returns a promise
function loadSample(audioContext, url){
          console.log('done');
    return new Promise(function(resolve, reject){
        fetch(url)
        .then((response) => {
            return response.arrayBuffer();
        })
        .then((buffer) =>{
            audioContext.decodeAudioData(buffer, (decodedAudioData) =>{
                resolve(decodedAudioData);
            });
        });
    });
}

