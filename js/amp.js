

// INITS
var audioPlayer, input2;
var demoSampleURLs = [
  "assets/audio/Guitar_DI_Track.mp3",
  "assets/audio/LasseMagoDI.mp3",
  "assets/audio/RawPRRI.mp3",
  "assets/audio/Di-Guitar.mp3",
  "assets/audio/NarcosynthesisDI.mp3",
  "assets/audio/BlackSabbathNIB_rythmDI.mp3",
  "assets/audio/BlackSabbathNIBLead_DI.mp3",
  "assets/audio/BasketCase Greenday riff DI.mp3",
  "assets/audio/InBloomNirvanaRiff1DI.mp3",
  "assets/audio/Muse1Solo.mp3",
  "assets/audio/Muse2Rythm.mp3"
];


function gotStream() {
    // Create an AudioNode from the stream.
    audioPlayer = document.getElementById('player');
    try {
        // if ShadowDOMPolyfill is defined, then we are using the Polymer
        // WebComponent polyfill that wraps the HTML audio
        // element into something that cannot be used with
        // createMediaElementSource. We use ShadowDOMPolyfill.unwrap(...)
        // to get the "real" HTML audio element
        audioPlayer = ShadowDOMPolyfill.unwrap(audioPlayer);
    } catch(e) {
        console.log("ShadowDOMPolyfill undefined, running native Web Component code");
    }

    
    if(input2 === undefined) {
        input2 = audioContext.createMediaElementSource(audioPlayer);
    }

    var input = audioContext.createMediaStreamSource(window.stream);
    audioInput = convertToMono(input);

    createAmp(audioContext, audioInput, input2);
    console.log('AMP CREATED')
}


function changeDemoSample(val) {
    console.log(val);
  audioPlayer.src = demoSampleURLs[val];
  audioPlayer.play();
}

var amp;
var analyzerAtInput, analyzerAtOutput;
var guitarPluggedIn = false;
var convolverSlider;
var convolverCabinetSlider;
var guitarInput;

// Create the amp
function createAmp(context, input1, input2) {
    guitarInput = input1;

    // create quadrafuzz
    amp = new Amp(context);
    analyzerAtInput = context.createAnalyser();
    amp.input.connect(analyzerAtInput);

    // build graph
    if(guitarPluggedIn) {
        guitarInput.connect(amp.input);
    }

    // connect audio player to amp for previewing presets
    input2.connect(amp.input);

    // output, add an analyser at the end
    analyzerAtOutput = context.createAnalyser();
    amp.output.connect(analyzerAtOutput);
    analyzerAtOutput.connect(context.destination);

    convolverSlider = document.querySelector('#convolverSlider');
    convolverCabinetSlider = document.querySelector('#convolverCabinetSlider');

    initVisualizations();
}

function toggleGuitarInput(event) {
    var button = document.querySelector("#toggleGuitarIn");

    if(!guitarPluggedIn) {
        guitarInput.connect(amp.input);
        button.innerHTML = "Guitar input: <span style='color:green;'>ACTIVATED</span>, click to toggle on/off!";
        button.classList.remove("pulse");
    } else {
        guitarInput.disconnect();
        button.innerHTML = "Guitar input: <span style='color:red;'>NOT ACTIVATED</span>, click to toggle on/off!";
        button.classList.add("pulse");
    }
    guitarPluggedIn = !guitarPluggedIn;
}

// Visualizations
var inputVisualization, outputVisualization;

function initVisualizations() {
    inputVisualization = new Visualization();
    inputVisualization.configure("inputSignalCanvas", analyzerAtInput);

    outputVisualization = new Visualization();
    outputVisualization.configure("outputSignalCanvas", analyzerAtOutput);


    // start updating the visualizations
    requestAnimationFrame(visualize);
}

function visualize() {
    inputVisualization.update();
    outputVisualization.update();

    requestAnimationFrame(visualize);
}

// effects
//----------- EQUALIZER ----------- 
function Equalizer(ctx) {
    var filters = [];

    // Set filters
    // Fred: 80 for the low end. 10000 useless, use shelf instead...
    [60, 170, 350, 1000, 3500, 10000].forEach(function (freq, i) {
        var eq = ctx.createBiquadFilter();
        eq.frequency.value = freq;
        eq.type = "peaking";
        eq.gain.value = 0;
        filters.push(eq);
    });

    // Connect filters in serie
    //sourceNode.connect(filters[0]);

    for (var i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
    }

    // connect the last filter to the speakers
    //filters[filters.length - 1].connect(ctx.destination);

    function changeGain(sliderVal, nbFilter) {
        // sliderVal in [-30, +30]
        var value = parseFloat(sliderVal);
        filters[nbFilter].gain.value = value;

        // update output labels
        //var output = document.querySelector("#gain" + nbFilter);
        //output.value = value + " dB";

        // update sliders
        //var numSlider = nbFilter + 1;
        //var slider = document.querySelector("#EQ" + numSlider + "slider");
        //slider.value = value;

        // refresh amp slider state in the web component GUI
        var sliderWC = document.querySelector("#slider" + (nbFilter+1));
        // second parameter set to false will not fire an event
        sliderWC.setValue(parseFloat(sliderVal).toFixed(0), false);
    }

    function setValues(values) {
        values.forEach(function (val, index) {
            changeGain(val, index);
        });
    }

    function getValues() {
        var values = [];
        filters.forEach(function (f, index) {
            values.push(f.gain.value);
        });
        return values;
    }

    return {
        input: filters[0],
        output: filters[filters.length - 1],
        setValues: setValues,
        getValues: getValues,
        changeGain: changeGain
    };
}

// ----------- AMP ---------------

function Amp(context) {
    var presets = [];
    var menuPresets = document.querySelector("#QFPresetMenu2");
    var menuDisto1 = document.querySelector("#distorsionMenu1");
    var menuDisto2 = document.querySelector("#distorsionMenu2");
    // for the waveshapers from the preamp
    var wsFactory = new WaveShapers();
    buildDistoMenu1();
    buildDistoMenu2();

    var currentDistoName = "standard";
    var currentK = 2; // we have separates ks, but also a "global" one that
                      // is the max of the two (the knob value)
    var currentWSCurve = wsFactory.distorsionCurves[currentDistoName](currentK);
    // for Wave Shaper Curves visualization
    var DRAWER_CANVAS_SIZE = 100;
    var distoDrawer1 = new CurveDrawer("distoDrawerCanvas1");
    var signalDrawer1 = new CurveDrawer("signalDrawerCanvas1");
    var distoDrawer2 = new CurveDrawer("distoDrawerCanvas2");
    var signalDrawer2 = new CurveDrawer("signalDrawerCanvas2");

    // ------------
    // PREAM STAGE
    // ------------
    // Channel booster
    var boost = new Boost(context);

    // Main input and output and bypass
    var input = context.createGain();
    var output = context.createGain();
    var byPass = context.createGain();
    byPass.gain.value = 0;

    // amp input gain towards pream stage
    var inputGain = context.createGain();
    inputGain.gain.value = 1;

    // tonestack
    var bassFilter, midFilter, trebleFilter, presenceFilter;

    // overdrives
    var k = [2, 2, 2, 2]; // array of k initial values
    var od = [];
    var distoTypes = ['asymetric', 'standard'];

    var gainsOds = [];

    // Tonestack in serie, cf Lepou's mail  
    /*
    for (var i = 0; i < 4; i++) {
        loCutFilters[i] = context.createBiquadFilter();
        loCutFilters[i].type = "lowshelf";
        loCutFilters[i].frequency.value = 720;
        loCutFilters[i].gain.value = 3.3;

        hiCutFilters[i] = context.createBiquadFilter();
        hiCutFilters[i].type = "lowpass";
        hiCutFilters[i].frequency.value = 12000;
        hiCutFilters[i].Q.value = 0.7071;

        highShelfBoosts[i] = context.createBiquadFilter();
        highShelfBoosts[i].type = "highshelf";
        highShelfBoosts[i].frequency.value = 12000; // Which values ?
        highShelfBoosts[i].Q.value = 0.7071;        // Which values ?

        od[i] = context.createWaveShaper();
        od[i].curve = makeDistortionCurve(k[i]);
        // Oversampling generates some (small) latency
        //od[i].oversample = '4x';

        // gains
        gainsOds[i] = context.createGain();
        gainsOds[i].gain.value = 1;
    }

    */
   
    // JCM 800 preamp schematic...
    //
    // Low shelf cut -6db à 720Hz
    var lowShelf1 = context.createBiquadFilter();
    lowShelf1.type = "lowshelf";
    lowShelf1.frequency.value = 720;
    lowShelf1.gain.value = -6;

    // Low shelf cut variable wired to volume knob
    // if vol = 50%, then filter at -6db, 320Hz
    // shoud go from -4db to -6db for +/- fatness
    var lowShelf2 = context.createBiquadFilter();
    lowShelf2.type = "lowshelf";    
    lowShelf2.frequency.value = 320;
    lowShelf2.gain.value = -5;

    // Gain 1
    var preampStage1Gain = context.createGain();
    preampStage1Gain.gain.value = 1.0;

    // Distorsion 1, here we should use an asymetric function in order to 
    // generate odd harmonics
    od[0] = context.createWaveShaper();
    od[0].curve =  wsFactory.distorsionCurves[distoTypes[0]](0);
    menuDisto1.value = distoTypes[0];

    // HighPass at 7-8 Hz, rectify the signal that got a DC value due
    // to the possible asymetric transfer function
    var highPass1 = context.createBiquadFilter();
    highPass1.type = "highpass";    
    highPass1.frequency.value = 6;
    highPass1.Q.value = 0.7071;

    // lowshelf cut -6db 720Hz
    var lowShelf3 = context.createBiquadFilter();
    lowShelf3.type = "lowshelf";    
    lowShelf3.frequency.value = 720;
    lowShelf3.gain.value = -6;

    // Gain 2
    var preampStage2Gain = context.createGain();
    preampStage2Gain.gain.value = 1;

    // Distorsion 2, symetric function to generate even harmonics
    od[1] = context.createWaveShaper();
    od[1].curve = wsFactory.distorsionCurves[distoTypes[1]](0);
    menuDisto2.value = distoTypes[1];

    changeDistorsionValues(4, 0);
    changeDistorsionValues(4, 1);

    // output gain after preamp stage
    var outputGain = context.createGain();
    changeOutputGainValue(7);

    // ------------------------------
    // TONESTACK STAGES
    // ------------------------------
    // Useless ?
    var bassFilter = context.createBiquadFilter();
    bassFilter.frequency.value = 100;
    bassFilter.type = "lowshelf";
    bassFilter.Q.value = 0.7071; // To check with Lepou

    var midFilter = context.createBiquadFilter();
    midFilter.frequency.value = 1700;
    midFilter.type = "peaking";
    midFilter.Q.value = 0.7071; // To check with Lepou

    var trebleFilter = context.createBiquadFilter();
    trebleFilter.frequency.value = 6500;
    trebleFilter.type = "highshelf";
    trebleFilter.Q.value = 0.7071; // To check with Lepou

    var presenceFilter = context.createBiquadFilter();
    presenceFilter.frequency.value = 3900;
    presenceFilter.type = "peaking";
    presenceFilter.Q.value = 0.7071; // To check with Lepou

    // -----------------------------------
    // POST PROCESSING STAGE (EQ, reverb)
    // -----------------------------------
    //  before EQ, filter highs and lows (Fred Miniere advise)
    var eqhicut = context.createBiquadFilter();
        eqhicut.frequency.value = 10000;
        eqhicut.type = "peaking";
        eqhicut.gain.value = -25;

    var eqlocut = context.createBiquadFilter();
        eqlocut.frequency.value = 60;
        eqlocut.type = "peaking";
        eqlocut.gain.value = -19;

    
    var eq = new Equalizer(context);
    changeEQValues([0, 0, 0, 0, 0, 0]);
    var bypassEQg = context.createGain();
    bypassEQg.gain.value = 0; // by defaut EQ is in
    var inputEQ = context.createGain();

    var cabinetSim, reverb;
    // Master volume
    var masterVolume = context.createGain();
    changeMasterVolume(2);
/*
    reverb = new Reverb(context, function () {
        console.log("reverb created");

        cabinetSim = new CabinetSimulator(context, function () {
            console.log("cabinet sim created");

            doAllConnections();

        });
    });
*/

    reverb = new Convolver(context, reverbImpulses, "reverbImpulses");
    cabinetSim = new Convolver(context, cabinetImpulses, "cabinetImpulses");

    doAllConnections();

    // -------------------
    // END OF AMP STAGES
    // -------------------

    function doAllConnections() {
        // called only after reverb and cabinet sim could load and
        // decode impulses

        // Build web audio graph, set default preset
        buildGraph();
        changeRoom(7.5); // TO REMOVE ONCE PRESETS MANAGER WORKS
        initPresets();

        setDefaultPreset();
        console.log("running");
    }


    function buildGraph() {
        input.connect(inputGain);
        input.connect(byPass);

        // boost is not activated, it's just a sort of disto at 
        // the very beginning of the amp route
        inputGain.connect(boost.input);
        // JCM 800 like...
        
        boost.output.connect(lowShelf1);
        lowShelf1.connect(lowShelf2);
        lowShelf2.connect(preampStage1Gain);
        preampStage1Gain.connect(od[0]);
        od[0].connect(highPass1);
        highPass1.connect(lowShelf3);

        lowShelf3.connect(preampStage2Gain);
        preampStage2Gain.connect(od[1])

        // end of preamp

        od[1].connect(outputGain);


        // tonestack
        outputGain.connect(trebleFilter );
        trebleFilter.connect(bassFilter);
        bassFilter.connect(midFilter);
        midFilter.connect(presenceFilter);

        // lo and hicuts
        presenceFilter.connect(eqlocut);
        eqlocut.connect(eqhicut);


        // post process
        eqhicut.connect(inputEQ);

        // bypass eq route
        eqhicut.connect(bypassEQg);
        bypassEQg.connect(masterVolume);

        // normal route
        
        inputEQ.connect(eq.input);
        eq.output.connect(masterVolume);
        masterVolume.connect(reverb.input);

        reverb.output.connect(cabinetSim.input);
        cabinetSim.output.connect(output);
        //eq.output.connect(output);
        //reverb.output.connect(output);

        // byPass route
        byPass.connect(output);
    }

    function boostOnOff(cb) {  
        // called when we click the switch on the GUI      
        boost.toggle();

        adjustOutputGainIfBoostActivated();
        updateBoostLedButtonState(boost.isActivated());
    }

    function changeBoost(state) {
        console.log("changeBoost, boost before: " + boost.isActivated() + " output gain=" + output.gain.value );

        if(boost.isActivated() !== state) {
            // we need to adjust the output gain
            console.log("changeBoost: we change boost state");
            boost.onOff(state);
            adjustOutputGainIfBoostActivated();
            updateBoostLedButtonState(boost.isActivated());
        } else {
            console.log("changeBoost: we do not change boost state");
        }

        console.log("changeBoost, boost after: " + boost.isActivated());
    }

    function adjustOutputGainIfBoostActivated() {
        console.log("adjustOutputGainIfBoostActivated: output gain value before = " + output.gain.value)

        if(boost.isActivated()) {
            output.gain.value /= 2;
        } else {
            output.gain.value *= 2;
        }
        console.log("adjustOutputGainIfBoostActivated: output gain value after = " + output.gain.value)
    }

    function updateBoostLedButtonState(activated) {
        // update buttons states
        var boostSwitch = document.querySelector("#toggleBoost");

        if(boost.isActivated()) {
            boostSwitch.setValue(1,false);
        } else {
            boostSwitch.setValue(0,false);
        }
    }


    function changeInputGainValue(sliderVal) {
        input.gain.value = parseFloat(sliderVal);
    }

    function changeOutputGainValue(sliderVal) {
        output.gain.value = parseFloat(sliderVal)/10;
        console.log("changeOutputGainValue value = " + output.gain.value);
    }

    // PREAMP

    function changeLowShelf1FrequencyValue(sliderVal) {
        var value = parseFloat(sliderVal);
        lowShelf1.frequency.value = value;

        // update output labels
        var output = document.querySelector("#lowShelf1Freq");
        output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

        // refresh slider state
        var slider = document.querySelector("#lowShelf1FreqSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changeLowShelf1GainValue(sliderVal) {
        var value = parseFloat(sliderVal);
        lowShelf1.gain.value = value;

        // update output labels
        var output = document.querySelector("#lowShelf1Gain");
        output.value = parseFloat(sliderVal).toFixed(1) + " dB";

        // refresh slider state
        var slider = document.querySelector("#lowShelf1GainSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changeLowShelf2FrequencyValue(sliderVal) {
        var value = parseFloat(sliderVal);
        lowShelf2.frequency.value = value;

        // update output labels
        var output = document.querySelector("#lowShelf2Freq");
        output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

        // refresh slider state
        var slider = document.querySelector("#lowShelf2FreqSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changeLowShelf2GainValue(sliderVal) {
        var value = parseFloat(sliderVal);
        lowShelf2.gain.value = value;

        console.log("lowshelf 2 gain = " + value);
        // update output labels
        var output = document.querySelector("#lowShelf2Gain");
        output.value = parseFloat(sliderVal).toFixed(1) + " dB";

        // refresh slider state
        var slider = document.querySelector("#lowShelf2GainSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changePreampStage1GainValue(sliderVal) {
        var value = parseFloat(sliderVal);
        preampStage1Gain.gain.value = value;

        // update output labels
        var output = document.querySelector("#preampStage1Gain");
        output.value = parseFloat(sliderVal).toFixed(2);

        // refresh slider state
        var slider = document.querySelector("#preampStage1GainSlider");
        slider.value = parseFloat(sliderVal).toFixed(2);
    }

    function changeHighPass1FrequencyValue(sliderVal) {
        var value = parseFloat(sliderVal);
        highPass1.frequency.value = value;

        // update output labels
        var output = document.querySelector("#highPass1Freq");
        output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

        // refresh slider state
        var slider = document.querySelector("#highPass1FreqSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changeHighPass1QValue(sliderVal) {
        var value = parseFloat(sliderVal);
        highPass1.Q.value = value;

        // update output labels
        var output = document.querySelector("#highPass1Q");
        output.value = parseFloat(sliderVal).toFixed(4);

        // refresh slider state
        var slider = document.querySelector("#highPass1QSlider");
        slider.value = parseFloat(sliderVal).toFixed(4);
    }

    function changeLowShelf3FrequencyValue(sliderVal) {
        var value = parseFloat(sliderVal);
        lowShelf3.frequency.value = value;

        // update output labels
        var output = document.querySelector("#lowShelf3Freq");
        output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

        // refresh slider state
        var slider = document.querySelector("#lowShelf3FreqSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changeLowShelf3GainValue(sliderVal) {
        var value = parseFloat(sliderVal);
        lowShelf3.gain.value = value;

        // update output labels
        var output = document.querySelector("#lowShelf3Gain");
        output.value = parseFloat(sliderVal).toFixed(1) + " dB";

        // refresh slider state
        var slider = document.querySelector("#lowShelf3GainSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changePreampStage2GainValue(sliderVal) {
        var value = parseFloat(sliderVal);
        preampStage2Gain.gain.value = value;

        // update output labels
        var output = document.querySelector("#preampStage2Gain");
        output.value = parseFloat(sliderVal).toFixed(2);

        // refresh slider state
        var slider = document.querySelector("#preampStage2GainSlider");
        slider.value = parseFloat(sliderVal).toFixed(2);
    }

    // END OF PREAMP

    function changeHicutFreqValue(sliderVal) {
        var value = parseFloat(sliderVal);
        for(var i =0; i < 4; i++) {
            hiCutFilters[i].frequency.value = value;
    }
        // update output labels
        var output = document.querySelector("#hiCutFreq");
        output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

        // refresh slider state
        var slider = document.querySelector("#hiCutFreqSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

  function changeBassFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        bassFilter.gain.value = (value-10) * 7;
        console.log("bass gain set to " + bassFilter.gain.value);

        // update output labels
        //var output = document.querySelector("#bassFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#bassFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        //sliderVal = value / 7 + 10;
        var knob = document.querySelector("#Knob4");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeMidFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        midFilter.gain.value = (value-5) * 4;

        // update output labels
        //var output = document.querySelector("#midFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#midFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
         //sliderVal = value /4 + 5;
        var knob = document.querySelector("#Knob5");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeTrebleFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        trebleFilter.gain.value = (value-10) * 10;

        // update output labels
        //var output = document.querySelector("#trebleFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#trebleFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        //sliderVal = value /10 + 10;
        var knob = document.querySelector("#Knob6");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changePresenceFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        presenceFilter.gain.value = (value-5) * 2;
        //console.log("set presence freq to " + presenceFilter.frequency.value)

        // update output labels
        //var output = document.querySelector("#presenceFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#presenceFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob8");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    // Build a drop down menu with all distorsion names
    function buildDistoMenu1() {
        for(var p in wsFactory.distorsionCurves) {
            var option = document.createElement("option");
            option.value = p;
            option.text = p;
            menuDisto1.appendChild(option);    
        }
        menuDisto1.onchange = changeDistoType1;
    }
    // Build a drop down menu with all distorsion names
    function buildDistoMenu2() {
        for(var p in wsFactory.distorsionCurves) {
            var option = document.createElement("option");
            option.value = p;
            option.text = p;
            menuDisto2.appendChild(option);    
        }
        menuDisto2.onchange = changeDistoType2;
    }

    function changeDistoType1() {
        console.log("Changing disto1 to : " + menuDisto1.value);
        currentDistoName = menuDisto1.value;   
        distoTypes[0] = currentDistoName;
        changeDrive(currentK);
    }

    function changeDistoType2() {
        console.log("Changing disto2 to : " + menuDisto2.value);
        currentDistoName = menuDisto2.value;   
        distoTypes[1] = currentDistoName;
        changeDrive(currentK);
    }

    function changeDisto1TypeFromPreset(name) {
        currentDistoName = name;
        menuDisto1.value = name;
        distoTypes[0] = currentDistoName;
        //changeDrive(currentK);
    }

    function changeDisto2TypeFromPreset(name) {
        currentDistoName = name;
        menuDisto2.value = name;
        distoTypes[1] = currentDistoName;
        //changeDrive(currentK);
    }

    function changeDrive(sliderValue) {
      // sliderValue in [0,10]
      // We can imagine having some "profiles here" -> generate
      // different K values from one single sliderValue for the
      // drive.
      // other values i.e [0.5, 0.5, 0.8, 1] -> less distorsion
      // on bass frequencies and top high frequency
      
      for(var i = 0; i < 2; i++) {
            changeDistorsionValues(sliderValue, i);
      }
    }

    function changeDistorsionValues(sliderValue, numDisto) {
        // sliderValue is in [0, 10] range, adjust to [0, 1500] range  
        var value = 150 * parseFloat(sliderValue);
        var minp = 0;
        var maxp = 1500;

        // The result should be between 10 an 1500
        var minv = Math.log(10);
        var maxv = Math.log(1500);

        // calculate adjustment factor
        var scale = (maxv - minv) / (maxp - minp);

        value = Math.exp(minv + scale * (value - minp));
        // end of logarithmic adjustment

        k[numDisto] = value;
        //console.log("k = " + value + " pos = " + logToPos(value));
        //console.log("distoTypes = " + distoTypes[numDisto]);
        od[numDisto].curve = wsFactory.distorsionCurves[distoTypes[numDisto]](k[numDisto]);//makeDistortionCurve(k[numDisto]);
        currentWSCurve = od[numDisto].curve;
        //od[numDisto].curve = makeDistortionCurve(sliderValue);
        //makeDistortionCurve(k[numDisto]);
        //od[numDisto].curve = makeDistortionCurve(sliderValue);
        // update output labels
        var output = document.querySelector("#k" + numDisto);
        output.value = parseFloat(sliderValue).toFixed(1);

        // update sliders
        var numSlider = numDisto + 1;
        var slider = document.querySelector("#K" + numSlider + "slider");
        slider.value = parseFloat(sliderValue).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob3");
        var maxPosVal1 = Math.max(logToPos(k[2]), logToPos(k[3]));
        var maxPosVal2 = Math.max(logToPos(k[0]), logToPos(k[1]));
        var maxPosVal = Math.max(maxPosVal1, maxPosVal2);
        //var maxPosVal = Math.max(logToPos(k[2]), logToPos(k[3]));
        var linearValue = parseFloat(maxPosVal).toFixed(1);
        knob.setValue(linearValue, false);
        // in [0, 10]
        currentK = linearValue;
        // redraw curves
        drawCurrentDistos();
    }

    function logToPos(logValue) {
        var minp = 0;
        var maxp = 1500;

        // The result should be between 10 an 1500
        var minv = Math.log(10);
        var maxv = Math.log(1500);

        // calculate adjustment factor
        var scale = (maxv - minv) / (maxp - minp);

        return (minp + (Math.log(logValue) - minv) / scale)/150;
    }

    function changeOversampling(cb) {
        for (var i = 0; i < 2; i++) {
            if(cb.checked) {
                // Oversampling generates some (small) latency
                od[i].oversample = '4x';
                boost.setOversampling('4x');
                console.log("set oversampling to 4x");
            } else {
                od[i].oversample = 'none';
                 boost.setOversampling('none');
                console.log("set oversampling to none");
            }
         }
         // Not sure if this is necessary... My ears can't hear the difference
         // between oversampling=node and 4x ? Maybe we should re-init the
         // waveshaper curves ?
         //changeDistoType1();
         //changeDistoType2();
    }

    // Returns an array of distorsions values in [0, 10] range
    function getDistorsionValue(numChannel) {
        var pos = logToPos(k[numChannel]);
        return parseFloat(pos).toFixed(1);
    }

    function drawCurrentDistos() {
        // draws both the transfer function and a sinusoidal
        // signal transformed, for each distorsion stage
        drawDistoCurves(distoDrawer1, signalDrawer1, od[0].curve);
        drawDistoCurves(distoDrawer2, signalDrawer2, od[1].curve);
    }

    function drawDistoCurves(distoDrawer, signalDrawer, curve) {
        var c = curve;
        distoDrawer.clear();
        drawCurve(distoDrawer, c);

        // draw signal
        signalDrawer.clear();
        signalDrawer.drawAxis();
        signalDrawer.makeCurve(Math.sin, 0, Math.PI * 2);
        signalDrawer.drawCurve('red', 2);

        //signalDrawer.makeCurve(distord, 0, Math.PI*2);
        var cTransformed = distord(c);
        drawCurve(signalDrawer, cTransformed);

    }

    function distord(c) {
        // return the curve of sin(x) transformed by the current wave shaper
        // function
        // x is in [0, 2*Math.PI]
        // sin(x) in [-1, 1]

        // current distorsion curve
        var curveLength = c.length;

        var c2 = new Float32Array(DRAWER_CANVAS_SIZE);
        // sin(x) -> ?
        // [-1, 1] -> [0, length -1]

        // 100 is the canvas size.
        var incX = 2 * Math.PI / DRAWER_CANVAS_SIZE;
        var x = 0;
        for (var i = 0; i < DRAWER_CANVAS_SIZE; i++) {
            var index = map(Math.sin(x), -1, 1, 0, curveLength - 1);
            c2[i] = c[Math.round(index)];
            x += incX;
        }
        return c2;
    }


    function changeQValues(sliderVal, numQ) {
        var value = parseFloat(sliderVal);
        filters[numQ].Q.value = value;

        // update output labels
        var output = document.querySelector("#q" + numQ);
        output.value = value.toFixed(1);

        // update sliders
        var numSlider = numQ + 1;
        var slider = document.querySelector("#Q" + numSlider + "slider");
        slider.value = value;

    }

    function changeFreqValues(sliderVal, numF) {
        var value = parseFloat(sliderVal);
        filters[numF].frequency.value = value;

        // update output labels
        var output = document.querySelector("#freq" + numF);
        output.value = value + " Hz";
        // refresh slider state
        var numSlider = numF + 1;
        var slider = document.querySelector("#F" + numSlider + "slider");
        slider.value = value;
    }

    // volume aka preamp output volume
    function changeOutputGain(sliderVal) {
        // sliderVal is in [0, 10]
        // Adjust to [0, 1]
        var value = parseFloat(sliderVal/10);
        outputGain.gain.value = value;

        // update output labels
        //var output = document.querySelector("#outputGain");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#OGslider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob1");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

        // volume aka preamp output volume
    function changeInputGain(sliderVal) {
        // sliderVal is in [0, 10]
        // Adjust to [0, 1]
        var value = parseFloat(sliderVal/10);
        inputGain.gain.value = value;

        // update output labels
        //var output = document.querySelector("#outputGain");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#OGslider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob1");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeMasterVolume(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        masterVolume.gain.value = value;

        // update output labels
        //var output = document.querySelector("#MVOutputGain");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#MVslider");
        //slider.value = parseFloat(sliderVal).toFixed(1);
        
        // refresh knob state
        var knob = document.querySelector("#Knob2");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeReverbGain(sliderVal) {
        // slider val in [0, 10] range
        // adjust to [0, 1]
        var value = parseFloat(sliderVal) / 10;
        reverb.setGain(value);

        // update output labels
        //var output = document.querySelector("#reverbGainOutput");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#convolverSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob7");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeReverbImpulse(name) {
        reverb.loadImpulseByName(name);
    }

    function changeRoom(sliderVal) {
        // slider val in [0, 10] range
        // adjust to [0, 1]
        console.log('change room');
        var value = parseFloat(sliderVal) / 10;
        cabinetSim.setGain(value);

        // update output labels
        var output = document.querySelector("#cabinetGainOutput");
        output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        var slider = document.querySelector("#convolverCabinetSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);

    }

    function changeCabinetSimImpulse(name) {
        cabinetSim.loadImpulseByName(name);
    }

    function changeEQValues(eqValues) {
        eq.setValues(eqValues);
    }

    function makeDistortionCurve(k) {
        // compute a new ws curve for current disto name and current k
        currentWSCurve = wsFactory.distorsionCurves[currentDistoName](k);
        return currentWSCurve;
    }

    // --------
    // PRESETS
    // --------
    function initPresets() {
        // updated 10/4/2016
        var preset1 = {"name":"Hard Rock classic 1","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":-5,"gain1":1,"distoName1":"asymetric","K1":"7.8","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"notSoDistorded","K2":"7.8","OG":"7.0","BF":"8.2","MF":"8.2","TF":"3.8","PF":"6.9","EQ":[5,11,-6,-10,7,2],"MV":"7.2","RN":"Fender Hot Rod","RG":"2.0","CN":"Marshall 1960, axis","CG":"9.4"};
        presets.push(preset1);

        var preset2 = {"name":"Clean and Warm","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":1.600000023841858,"gain1":1,"distoName1":"asymetric","K1":"7.8","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"standard","K2":"0.9","OG":"7.0","BF":"6.7","MF":"7.1","TF":"3.2","PF":"6.9","EQ":[10,5,-7,-7,16,0],"MV":"7.2","RN":"Fender Hot Rod","RG":"1.4","CN":"Marshall 1960, axis","CG":"8.8"};
        presets.push(preset2);

        var preset3 = {"name":"Strong and Warm","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":-1,"gain1":1.0299999713897705,"distoName1":"asymetric","K1":"7.8","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"superClean","K2":"7.8","OG":"7.0","BF":"8.2","MF":"6.7","TF":"5.0","PF":"6.9","EQ":[0,0,0,-1,0,1],"MV":"5.9","RN":"Fender Hot Rod","RG":"1.1","CN":"Vox Custom Bright 4x12 M930 Axis 1","CG":"8.0"};
        presets.push(preset3);

        //preset4 = {"name":"Fat sound","boost":true,"LS1Freq":720,"LS1Gain":-5.800000190734863,"LS2Freq":320,"LS2Gain":6.599999904632568,"gain1":0.11999999731779099,"distoName1":"asymetric","K1":"5.4","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-5.199999809265137,"gain2":1,"distoName2":"standard","K2":"5.4","OG":"3.5","BF":"3.2","MF":"5.0","TF":"5.0","PF":"9.7","EQ":[1,0,-6,-8,-6,-30],"MV":"3.1","RN":"Fender Hot Rod","RG":"0.0","CN":"Marshall 1960, axis","CG":"3.4"};
        //presets.push(preset4);
        var preset4 = {"name":"Clean no reverb","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":-6.300000190734863,"gain1":1,"distoName1":"asymetric","K1":"2.1","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"crunch","K2":"2.1","OG":"7.0","BF":"6.7","MF":"5.0","TF":"5.0","PF":"8.9","EQ":[4,13,-8,-8,15,12],"MV":"3.7","RN":"Fender Hot Rod","RG":"0.0","CN":"Marshall 1960, axis","CG":"4.5"};
        presets.push(preset4);

        var preset5 = {"name":"Another Clean Sound","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":-6.300000190734863,"gain1":1,"distoName1":"asymetric","K1":"6.4","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"crunch","K2":"6.4","OG":"7.0","BF":"6.7","MF":"5.0","TF":"5.0","PF":"8.9","EQ":[4,13,-8,-8,15,12],"MV":"3.7","RN":"Fender Hot Rod","RG":"2","CN":"Marshall 1960, axis","CG":"4.5"};
        presets.push(preset5);

        var preset6 = {"name":"Mostly even harmonics","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":-7.5,"gain1":1,"distoName1":"standard","K1":"6.7","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"standard","K2":"6.7","OG":"7.0","BF":"4.3","MF":"2.6","TF":"6.1","PF":"4.2","EQ":[5,12,-5,-10,2,10],"MV":"1.7","RN":"Fender Hot Rod","RG":"0.0","CN":"Vintage Marshall 1","CG":"8.4"};
        presets.push(preset6);

        var preset7 = {"name":"Hard Rock classic 2","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":-10.199999809265137,"gain1":1,"distoName1":"standard","K1":"5.2","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"notSoDistorded","K2":"5.1","OG":"7.0","BF":"8.7","MF":"8.0","TF":"3.8","PF":"9.4","EQ":[19,8,-6,-10,7,2],"MV":"5.5","RN":"Fender Hot Rod","RG":"0.7","CN":"Marshall 1960, axis","CG":"9.2"};
        presets.push(preset7);
        
        var preset8 = {"name":"SuperClean/Jazz","boost":false,"LS1Freq":720,"LS1Gain":-6,"LS2Freq":320,"LS2Gain":-6.300000190734863,"gain1":1,"distoName1":"crunch","K1":"5.4","HP1Freq":6,"HP1Q":0.707099974155426,"LS3Freq":720,"LS3Gain":-6,"gain2":1,"distoName2":"crunch","K2":"5.4","OG":"7.0","BF":"7.0","MF":"5.1","TF":"5.2","PF":"3.1","EQ":[10,7,0,-10,5,12],"MV":"3.8","RN":"Fender Hot Rod","RG":"1.5","CN":"Marshall 1960, axis","CG":"4.5"};
        presets.push(preset8);

        presets.forEach(function (p, index) {
            var option = document.createElement("option");
            option.value = index;
            option.text = p.name;
            menuPresets.appendChild(option);
        });
        menuPresets.onchange = changePreset;
    }

    function changePreset() {
        setPreset(presets[menuPresets.value]);
    }

    function setPreset(p) {
        if(p.distoName1 === undefined) {
            p.distoName1 = "standard";
        }
         if(p.distoName2 === undefined) {
            p.distoName2 = "standard";
        }

        if(p.boost === undefined) p.boost = false;
        changeBoost(p.boost);

        // stage 1
        changeLowShelf1FrequencyValue(p.LS1Freq);
        changeLowShelf1GainValue(p.LS1Gain);
        changeLowShelf2FrequencyValue(p.LS2Freq);
        changeLowShelf2GainValue(p.LS2Gain);
        changePreampStage1GainValue(p.gain1);
        changeDisto1TypeFromPreset(p.distoName1);
        changeDistorsionValues(p.K1, 0);

        // stage 2
        changeLowShelf3FrequencyValue(p.LS3Freq);
        changeLowShelf3GainValue(p.LS3Gain);
        changePreampStage2GainValue(p.gain2);
        changeDisto2TypeFromPreset(p.distoName2);
        changeDistorsionValues(p.K2, 1);

        changeOutputGain(p.OG);

        changeBassFilterValue(p.BF);
        changeMidFilterValue(p.MF);
        changeTrebleFilterValue(p.TF);
        changePresenceFilterValue(p.PF);

        changeMasterVolume(p.MV);

        changeReverbGain(p.RG);
        changeReverbImpulse(p.RN);

        changeRoom(p.CG);
        changeCabinetSimImpulse(p.CN);

        changeEQValues(p.EQ);
    }

    function getPresets() {
        return presets;
    }

    function setDefaultPreset() {
        setPreset(presets[0]);
    }

    function printCurrentAmpValues() {
        var currentPresetValue = {
            name: 'current',
            
            boost: boost.isActivated(),

            LS1Freq: lowShelf1.frequency.value,
            LS1Gain: lowShelf1.gain.value,
            LS2Freq: lowShelf2.frequency.value,
            LS2Gain: lowShelf2.gain.value,
            gain1: preampStage1Gain.gain.value,
            distoName1 : menuDisto1.value,
            K1: getDistorsionValue(0),
            HP1Freq: highPass1.frequency.value,
            HP1Q: highPass1.Q.value,

            LS3Freq: lowShelf3.frequency.value,
            LS3Gain: lowShelf3.gain.value,
            gain2: preampStage2Gain.gain.value,
            distoName2 : menuDisto2.value,
            K2: getDistorsionValue(1),

            OG: (output.gain.value*10).toFixed(1),
            BF: ((bassFilter.gain.value / 7) + 10).toFixed(1), // bassFilter.gain.value = (value-5) * 3;
            MF: ((midFilter.gain.value / 4) + 5).toFixed(1), // midFilter.gain.value = (value-5) * 2;
            TF: ((trebleFilter.gain.value / 10) + 10).toFixed(1), // trebleFilter.gain.value = (value-5) * 5;
            PF: ((presenceFilter.gain.value / 2) + 5).toFixed(1), // presenceFilter.gain.value = (value-5) * 2;
            EQ: eq.getValues(),
            MV: masterVolume.gain.value.toFixed(1),
            RN: reverb.getName(),
            RG: (reverb.getGain()*10).toFixed(1),
            CN: cabinetSim.getName(),
            CG: (cabinetSim.getGain()*10).toFixed(1)
       };

       console.log(JSON.stringify(currentPresetValue));
    }

    // END PRESETS

    function bypass(cb) {
        console.log("byPass : " + cb.checked);

        if (cb.checked) {
            // byPass mode
            inputGain.gain.value = 1;
            byPass.gain.value = 0;
        } else {
            // normal amp running mode
            inputGain.gain.value = 0;
            byPass.gain.value = 1;
        }

        // update buttons states
        //var onOffButton = document.querySelector("#myonoffswitch");
        var led = document.querySelector("#led");

        //onOffButton.checked = cb.checked;
        var onOffSwitch = document.querySelector("#switch1");
        if(cb.checked) {
            onOffSwitch.setValue(0,false);
            led.setValue(1, false);
        } else {
            onOffSwitch.setValue(1,false);
            led.setValue(0, false);
        }
    }

    function bypassEQ(cb) {
        console.log("EQ byPass : " + cb.checked);

        if (cb.checked) {
            // byPass mode
            inputEQ.gain.value = 1;
            bypassEQg.gain.value = 0;
        } else {
            // normal amp running mode
            inputEQ.gain.value = 0;
            bypassEQg.gain.value = 1;
        }

        // update buttons states
        //var onOffButton = document.querySelector("#myonoffswitch");
        var led = document.querySelector("#led");

        //onOffButton.checked = cb.checked;
        var eqOnOffSwitch = document.querySelector("#switch2");
        if(cb.checked) {
            eqOnOffSwitch.setValue(0,false);
        } else {
            eqOnOffSwitch.setValue(1,false);
        }
    }

    // API: methods exposed
    return { 
        input: input,
        output: output,
        boostOnOff:boostOnOff,
        eq: eq,
        reverb: reverb,
        cabinet: cabinetSim,
        changeInputGainValue: changeInputGainValue,
        changeOutputGainValue:changeOutputGainValue,

        changeLowShelf1FrequencyValue: changeLowShelf1FrequencyValue,
        changeLowShelf1GainValue: changeLowShelf1GainValue,
        changeLowShelf2FrequencyValue: changeLowShelf2FrequencyValue,
        changeLowShelf2GainValue: changeLowShelf2GainValue,
        changePreampStage1GainValue: changePreampStage1GainValue,
        changeHighPass1FrequencyValue: changeHighPass1FrequencyValue,
        changeHighPass1QValue: changeHighPass1QValue,
        changeLowShelf3FrequencyValue: changeLowShelf3FrequencyValue,
        changeLowShelf3GainValue: changeLowShelf3GainValue,
        changePreampStage2GainValue: changePreampStage2GainValue,

        changeBassFilterValue : changeBassFilterValue,
        changeMidFilterValue : changeMidFilterValue,
        changeTrebleFilterValue : changeTrebleFilterValue,
        changePresenceFilterValue : changePresenceFilterValue,
        changeDrive: changeDrive,
        changeDistorsionValues: changeDistorsionValues,
        changeOversampling: changeOversampling,
        changeOutputGain: changeOutputGain,
        changeInputGain: changeInputGain,

        changeMasterVolume: changeMasterVolume,
        changeReverbGain: changeReverbGain,
        changeRoom: changeRoom,
        changeEQValues: changeEQValues,
        setDefaultPreset: setDefaultPreset,
        getPresets: getPresets,
        setPreset: setPreset,
        printCurrentAmpValues : printCurrentAmpValues,
        bypass: bypass,
        bypassEQ: bypassEQ
    };
}

var reverbImpulses = [
        {
            name: "Fender Hot Rod",
            url: "assets/impulses/reverb/cardiod-rear-levelled.wav"
        },
        {
            name: "PCM 90 clean plate",
            url: "assets/impulses/reverb/pcm90cleanplate.wav"
        },
        {
            name: "Scala de Milan",
            url: "assets/impulses/reverb/ScalaMilanOperaHall.wav"
        }
    ];
var cabinetImpulses = [
{
            name: "Marshall 1960, axis",
            url: "assets/impulses/cabinet/Marshall1960.wav"
        },    
        {
            name: "Vintage Marshall 1",
            url: "assets/impulses/cabinet/Block%20Inside.wav"
        },
        {
            name: "Vox Custom Bright 4x12 M930 Axis 1",
            url: "assets/impulses/cabinet/voxCustomBrightM930OnAxis1.wav"
        },
        {
            name: "Fender Champ, axis",
            url: "assets/impulses/cabinet/FenderChampAxisStereo.wav"
        }
    ];
// ------- CONVOLVER, used for both reverb and cabinet simulation -------------------
function Convolver(context, impulses, menuId) {
    var convolverNode, convolverGain, directGain;
    // create source and gain node
    var inputGain = context.createGain();
    var outputGain = context.createGain();
    var decodedImpulse;

    var menuIRs;
    var IRs = impulses;

    var currentImpulse = IRs[0];
    var defaultImpulseURL = IRs[0].url;

    convolverNode = context.createConvolver();
    convolverNode.buffer = decodedImpulse;

    convolverGain = context.createGain();
    convolverGain.gain.value = 0;

    directGain = context.createGain();
    directGain.gain.value = 1;

    buildIRsMenu(menuId);
    buildAudioGraphConvolver();
    setGain(0.2);
    loadImpulseByUrl(defaultImpulseURL);
    

    function loadImpulseByUrl(url) {
        // Load default impulse
        const samples = Promise.all([loadSample(context,url)]).then(setImpulse);
    }

    function loadImpulseByName(name) {
        if(name === undefined) {
            name = IRs[0].name;
            console.log("loadImpulseByName: name undefined, loading default impulse " + name);
        }

        var url="none";
        // get url corresponding to name
        for(var i=0; i < IRs.length; i++) {
            if(IRs[i].name === name) {
                url = IRs[i].url;
                currentImpulse = IRs[i];
                menuIRs.value = i;
                break;
            }
        }
        if(url === "none") {
            console.log("ERROR loading reverb impulse name = " + name);
        } else {
            console.log("loadImpulseByName loading " + currentImpulse.name);
            loadImpulseByUrl(url);
        }
    }

    function loadImpulseFromMenu() {
        var url = IRs[menuIRs.value].url;
        currentImpulse = IRs[menuIRs.value];
        console.log("loadImpulseFromMenu loading " + currentImpulse.name);
        loadImpulseByUrl(url);
    }

    function setImpulse(param) {
     // we get here only when the impulse is loaded and decoded
        console.log("impulse loaded and decoded");
        convolverNode.buffer = param[0];
        console.log("convolverNode.buffer set with the new impulse (loaded and decoded");
    }

    function buildAudioGraphConvolver() {
        // direct/dry route source -> directGain -> destination
        inputGain.connect(directGain);
        directGain.connect(outputGain);

        // wet route with convolver: source -> convolver 
        // -> convolverGain -> destination
        inputGain.connect(convolverNode);
        convolverNode.connect(convolverGain);
        convolverGain.connect(outputGain);
    }

    function setGain(value) {
        var v1 = Math.cos(value * Math.PI / 2);
        var v2 = Math.cos((1 - value) * Math.PI / 2);

        directGain.gain.value = v1;
        convolverGain.gain.value = v2;
    }

    function getGain() {
        return 2 * Math.acos(directGain.gain.value) / Math.PI;
    }

    function getName() {
        return currentImpulse.name;
    }


    function buildIRsMenu(menuId) {
        menuIRs = document.querySelector("#" + menuId);

        IRs.forEach(function (impulse, index) {
            var option = document.createElement("option");
            option.value = index;
            option.text = impulse.name;
            menuIRs.appendChild(option);
        });

        menuIRs.oninput = loadImpulseFromMenu;
    }
    //--------------------------------------
    // API : exposed methods and properties
    // -------------------------------------
    return {
        input: inputGain,
        output: outputGain,
        setGain: setGain,
        getGain: getGain,
        getName:getName,
        loadImpulseByName: loadImpulseByName
    };
}

// Booster, useful to add a "Boost channel"
var Boost = function(context) {
    // Booster not activated by default
    var activated = false;

    var input = context.createGain();
    var inputGain = context.createGain();
    inputGain.gain.value = 0;
    var byPass = context.createGain();
    byPass.gain.value = 1;
    var filter = context.createBiquadFilter();
    filter.frequency.value = 3317;
    var shaper = context.createWaveShaper();
    shaper.curve = makeDistortionCurve(640);
    var outputGain = context.createGain();
    outputGain.gain.value = 2;
    var output = context.createGain();

    // build graph
    input.connect(inputGain);
    inputGain.connect(shaper);
    shaper.connect(filter);
    filter.connect(outputGain);
    outputGain.connect(output);

    // bypass route
    input.connect(byPass);
    byPass.connect(output);

    function isActivated() {
        return activated;
    }

    function onOff(wantedState) {
        if(wantedState === undefined) {
            // do not boost
            if(activated) toggle();
            return;
        }
        var currentState = activated;

        if(wantedState !== currentState) {
            toggle();
        }
    }

    function toggle() {
        if(!activated) {
            byPass.gain.value = 0;
            inputGain.gain.value = 1;
        } else {
            byPass.gain.value = 1;
            inputGain.gain.value = 0;
        }
        activated = !activated;
    }

    function setOversampling(value) {
        shaper.oversample = value;
        console.log("boost set oversampling to " + value);
    }

    function makeDistortionCurve(k) {
        var n_samples = 44100; //65536; //22050;     //44100
        var curve = new Float32Array(n_samples);
        var deg = Math.PI / 180;
        for (var i = 0; i < n_samples; i += 1) {
            var x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
    // API
    return {
        input:input,
        output:output,
        onOff: onOff,
        toggle:toggle,
        isActivated: isActivated,
        setOversampling: setOversampling
    };
};
 