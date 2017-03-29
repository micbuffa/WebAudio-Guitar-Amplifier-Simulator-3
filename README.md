# WebAudio-Guitar-Amplifier-Simulator
A Guitar Amplifier Simulator written using the Web Audio API. This is a new design completely different from the other amp sim I published on GitHub.

This one has a preamp close to the one of the Marshall JCM 800. The tonestack (bass/med/treble) is not 100% accurate, and the power amp stage has been modeled using a gain + waveshaper (the power amp stage influences the final sound, but less than the preamp).

![WebAudio Amp Simulator](http://mainline.i3s.unice.fr/AmpSim3/AmpSimFA.jpg)

See it in also action in these videos:
https://www.youtube.com/watch?v=5q5jRh4qV_w and https://www.youtube.com/watch?v=7bf3Dgl-qGc



The GUI uses the Web Audio Controls web components by g200Kg.

How to use?
-----------

For the moment, you need Google Chrome or FireFox (did not test with Microsoft Edge), preferably on Mac OSX or Linux/Jack (FF only, you'll need a special build or to add some command line options) if you want a low latency and be able to play guitar in hands without feeling the latency.

The Amp has been tested with a Mac Book Pro and different sound cards (Apogee Jam, different Presonus and RMEs) and works in real time with a very low latency (12-14ms). The latency is system and sound card dependent, so you've got to try. 

You can try the Amp Sim without a guitar, just go to https://mainline.i3s.unice.fr/AmpSim3, wait until the eq sliders come up (that
means that the reverb and cabinet simulator impulses have been loaded and decoded), and press the play button of the audio player on
the left. Then you can try adjusting the knobs, sliders, change the presets from the preset menu etc.

If you want to try with a real guitar, it's better to use an external sound card, plug your guitar in it and set this input as the
default input in your Operating System preferences. Then reload the page and press the button that is animated (zomming in and out) in
the front panel of the Amp: it will enable microphone or sound card input. Then play :-)

How to run from github?
-----------------------
Clone the repo, then run "npm install" and "node server.js". By default the server runs on port 8084 so open  http://localhost:8084 in
your browser. You can change the port, edit server.js.

If you plan to host the app somewhere, you need to have a server that support HTTPS as the getUserMedia API we use for getting the input audio stream from the microphone or sound card requires HTTPS.

How to add presets?
-------------------

So far, there is no persistence system implemented for saving the presets. There are all located in the amp.js file, look for "preset".
If you open the console in your browser devtools and press the "show current settings" button, then it will print an array object in the
console. Just copy and paste this value in the code of amp.js, after the current presets. If it sounds good, do not forget to email this
to me too (micbuffa@gmail.com).
