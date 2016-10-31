window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();

window.addEventListener('load', startWithFirefoxComaptibility /*start*/);

function convertToMono(input) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(merger, 0, 1);
    return merger;
}

var lpInputFilter = null;

// this is ONLY because we have massive feedback without filtering out
// the top end in live speaker scenarios.
function createLPInputFilter() {
    lpInputFilter = audioContext.createBiquadFilter();
    lpInputFilter.frequency.value = 2048;
    return lpInputFilter;
}


var useFeedbackReduction = true;
function initAudio() {
    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    if (!navigator.getUserMedia)
        return(alert("Error: getUserMedia not supported!"));

    navigator.getUserMedia(constraints, gotStream, function (e) {
        alert('Error getting audio');
        console.log(e);
    });

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.log("enumerateDevices() not supported.");
    } else {
        //MediaStreamTrack.MediaDevices.enumerateDevices(gotSources);
        navigator.mediaDevices.enumerateDevices()
                .then(function (devices) {
                    devices.forEach(function (device) {
                        console.log(device.kind + ": " + device.label +
                                " id = " + device.deviceId);
                    });
                    gotDevices(devices);
                })
                .catch(function (err) {
                    console.log(err.name + ": " + error.message);
                });
    }
}

var audioInputSelect;
var audioOutputSelect;
var selectors;

function start() {
    audioInputSelect = document.querySelector('select#audioSource');
    audioInputSelect.onchange = start;
    audioOutputSelect = document.querySelector('select#audioOutput');

    selectors = [audioInputSelect, audioOutputSelect];

    if (window.stream) {
        window.stream.getTracks().forEach(function (track) {
            track.stop();
        });
    }
    var audioSource = audioInputSelect.value;

    // MANDATORY : set echoCancellation to false, otherwise
    // Automatic Gain Control is enabled and the signal
    // level auto adjusted, affecting badly the guitar input
    // signal and adding latency
    var constraints = {
        audio: {
            deviceId: audioSource ? {exact: audioSource} : undefined,
            mandatory: {echoCancellation: false}
        }
    };
    navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                window.stream = stream; // make stream available to console
                // Refresh button list in case labels have become available
                return navigator.mediaDevices.enumerateDevices();
            })
            .then(gotDevices)
            .then(gotStream);
    //.catch(errorCallback);
}

function startWithFirefoxComaptibility() {
    var constraints = { 
       audio: {
            echoCancellation: false, mozNoiseSuppression: false, mozAutoGainControl: false  
       } 
   };

    navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                window.stream = stream; // make stream available to console
                // Refresh button list in case labels have become available
            })
            .then(gotStream);
}

function gotDevices(deviceInfos) {
    // Handles being called several times to update labels. Preserve values.
    var values = selectors.map(function (select) {
        return select.value;
    });
    selectors.forEach(function (select) {
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }
    });
    for (var i = 0; i !== deviceInfos.length; ++i) {
        var deviceInfo = deviceInfos[i];
        var option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label ||
                    'microphone ' + (audioInputSelect.length + 1);
            audioInputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'audiooutput') {
            option.text = deviceInfo.label || 'speaker ' +
                    (audioOutputSelect.length + 1);
            audioOutputSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            //option.text = deviceInfo.label || 'camera ' + (videoSelect.length + 1);
            //videoSelect.appendChild(option);
        } else {
            console.log('Some other kind of source/device: ', deviceInfo);
        }
    }
    selectors.forEach(function (select, selectorIndex) {
        if (Array.prototype.slice.call(select.childNodes).some(function (n) {
            return n.value === values[selectorIndex];
        })) {
            select.value = values[selectorIndex];
        }
    });
}
function errorCallback(error) {
    console.log('navigator.getUserMedia error: ', error);
}
