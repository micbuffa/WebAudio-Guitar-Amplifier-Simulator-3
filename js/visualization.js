// ---- visualize signals in real time
function Visualization() {
  var canvas;
  var audioContext, canvasContext;
  var gradient;
  var analyser;
  var width, height;
  var analyzer;

  var dataArray, bufferLength;

  function configure(canvasId, analzr) {
    analyzer = analzr;
    canvas = document.querySelector("#"+canvasId);
    width = canvas.width;
    height = canvas.height;
    canvasContext = canvas.getContext('2d');
    
    // create a vertical gradient of the height of the canvas
    gradient = canvasContext.createLinearGradient(0,0,0, height);
    gradient.addColorStop(0,'#000000');
    gradient.addColorStop(0.25,'#ff0000');
    gradient.addColorStop(0.75,'#ffff00');
    gradient.addColorStop(1,'#00FF00');
    
    //buildAudioGraph();
    
    // Try changing for lower values: 512, 256, 128, 64...
      analyzer.fftSize = 1024;
      bufferLength = analyzer.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
  };

  function clearCanvas() {
     canvasContext.save();
    
     // clear the canvas
     // like this: canvasContext.clearRect(0, 0, width, height);
    
     // Or use rgba fill to give a slight blur effect
    canvasContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
    canvasContext.fillRect(0, 0, width, height);
    
    canvasContext.restore();
  }

  function update() {
    
    clearCanvas();  
    drawVolumeMeter();
    drawWaveform();
  }

  function drawWaveform() {
    canvasContext.save();
    // Get the analyser data
    analyzer.getByteTimeDomainData(dataArray);

    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = 'lightBlue';

    // all the waveform is in one single path, first let's
    // clear any previous path that could be in the buffer
    canvasContext.beginPath();
    
    var sliceWidth = width / bufferLength;
    var x = 0;
    
        // values go from 0 to 256 and the canvas heigt is 100. Let's rescale
        // before drawing. This is the scale factor
        heightScale = height/128;

    for(var i = 0; i < bufferLength; i++) {
       // dataArray[i] between 0 and 255
       var v = dataArray[i] / 255;
       var y = v * height;
      
       if(i === 0) {
          canvasContext.moveTo(x, y);
       } else {
          canvasContext.lineTo(x, y);
       }

       x += sliceWidth;
    }

    canvasContext.lineTo(canvas.width, canvas.height/2);
    
    // draw the path at once
    canvasContext.stroke();    
    canvasContext.restore();
  }

  function drawVolumeMeter() {
    canvasContext.save();
    
    analyzer.getByteFrequencyData(dataArray);
    var average = getAverageVolume(dataArray);
    
    // set the fill style to a nice gradient
    canvasContext.fillStyle=gradient;
   
    // draw the vertical meter
    var value = Math.max(height-average*0.5, 0)
    canvasContext.fillRect(0,value,25,height);
    
    canvasContext.restore();
  }

  function getAverageVolume(array) {
    var values = 0;
    var average;

    var length = array.length;

    // get all the frequency amplitudes
    for (var i = 0; i < length; i++) {
        values += array[i];
    }

    average = values / length;
    return average;
  }

  // API
  return {
    configure: configure,
    update:update
  }
}
