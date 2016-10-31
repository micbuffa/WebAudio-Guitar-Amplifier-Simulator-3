function WaveShapers() {
    var distorsionCurves = {};

    buildDistorsionFactories();

    function buildDistorsionFactories() {
        // all distorsion values in [0, 1500]

        // classic curve from WebAudio specification
        distorsionCurves.standard = function (distorsionValue) {
            var k = distorsionValue;
            var c = classicDistorsion(k);
            return c;
        };

        // classic curve variant from WebAudio specification
        distorsionCurves.standardLower = function (distorsionValue) {
            var k = distorsionValue;
            var c = classicDistorsion2(k);

            //var c1 = scaleCurve(c, 2, 2);
            return c;
        };

        distorsionCurves.smooth = function (distorsionValue) {
            var c = new Float32Array(44100);
            var kTuna = distorsionValue / 1500;
            smooth(kTuna, 44100, c);
            return c;
        };

        distorsionCurves.fuzz = function (distorsionValue) {
            var c = new Float32Array(44100);
            var kTuna = distorsionValue / 1500;
            fuzz(kTuna, 44100, c);
            return c;
        };

        distorsionCurves.clean = function (distorsionValue) {
            var c = new Float32Array(44100);
            var kTuna = distorsionValue / 1500;
            clean(kTuna, 44100, c);
            return c;
        };

        
        distorsionCurves.asymetric = function (distorsionValue) {
            var c = new Float32Array(44100);
            var kTuna = distorsionValue / 1500;
            asymetric(kTuna, 44100, c);
            return c;
        };
        
                // classic curve from WebAudio specification
        distorsionCurves.bezier = function (distorsionValue) {
            var k = distorsionValue;
            var c = getBezierCurve();
            return c;
        };


        distorsionCurves.notSoDistorded = function (distorsionValue) {
            var k = distorsionValue / 150;
            var c = notSoDistorded(k);
            return c;
        };

        distorsionCurves.crunch = function (distorsionValue) {
            var k = distorsionValue / 150;
            var c = crunch(k);
            return c;
        };

        distorsionCurves.ClassA = function (distorsionValue) {
            var k = distorsionValue / 150;
            var c = classA(k);
            return c;
        };

        distorsionCurves.superClean = function (distorsionValue) {
            var k = distorsionValue / 150;
            var c = superClean(k);
            return c;
        };

        distorsionCurves.vertical = function (distorsionValue) {
            var k = distorsionValue / 150;
            var c = vertical(k);
            return c;
        };

        distorsionCurves.superFuzz = function (distorsionValue) {
            var k = distorsionValue / 150;
            var c = superFuzz(k);
            return c;
        };

        distorsionCurves.NoisyHiGain = function (distorsionValue) {
            var k = distorsionValue / 10;
            var c = NoisyHiGain(k);
            return c;
        };

        distorsionCurves.HiGainModern = function (distorsionValue) {
            var k = distorsionValue / 2;
            var c = HiGainModern(k);
            return c;
        };
    }
    // ----------------------------------
    // ---- wave shaping functions ------
    // ----------------------------------
    // Classic one
    function classicDistorsion(k) {
        var n_samples = 44100,
                curve = new Float32Array(n_samples),
                deg = Math.PI / 180, i = 0, x;

        for (; i < n_samples; ++i) {
            x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 57 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    function classicDistorsion2(k) {
        var n_samples = 44100,
                curve = new Float32Array(n_samples),
                deg = Math.PI / 180, i = 0, x;

        for (; i < n_samples; ++i) {
            x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    // Tuna JS 1
    function smooth(amount, n_samples, ws_table) {
        amount = Math.min(amount, 0.9);
        var k = 2 * amount / (1 - amount),
                i, x;
        for (i = 0; i < n_samples; i++) {
            x = i * 2 / n_samples - 1;
            ws_table[i] = (1 + k) * x / (1 + k * Math.abs(x));
        }
    }

    // Tuna JS 3
    function fuzz(amount, n_samples, ws_table) {
        var i, x, y, a = 1 - amount;
        for (i = 0; i < n_samples; i++) {
            x = i * 2 / n_samples - 1;
            y = x < 0 ? -Math.pow(Math.abs(x), a + 0.04) : Math.pow(x, a);
            ws_table[i] = tanh(y * 2);
        }
    }
    // Tuna JS 4
    function clean(amount, n_samples, ws_table) {
        var i, x, y, abx, a = 1 - amount > 0.99 ? 0.99 : 1 - amount;
        for (i = 0; i < n_samples; i++) {
            x = i * 2 / n_samples - 1;
            abx = Math.abs(x);
            if (abx < a)
                y = abx;
            else if (abx > a)
                y = a + (abx - a) / (1 + Math.pow((abx - a) / (1 - a), 2));
            else if (abx > 1)
                y = abx;
            ws_table[i] = sign(x) * y * (1 / ((a + 1) / 2));
        }
    }

    // tuna JS 5
    function asymetric(amount, n_samples, ws_table) {
        var i, x;
        for (i = 0; i < n_samples; i++) {
            x = i * 2 / n_samples - 1;
            if (x < -0.08905) {
                ws_table[i] = (-3 / 4) * (1 - (Math.pow((1 - (Math.abs(x) - 0.032857)), 12)) + (1 / 3) * (Math.abs(x) - 0.032847)) + 0.01;
            } else if (x >= -0.08905 && x < 0.320018) {
                ws_table[i] = (-6.153 * (x * x)) + 3.9375 * x;
            } else {
                ws_table[i] = 0.630035;
            }
        }
    }


    // From GFX, tweaked for most of them...
    function notSoDistorded(a) {
        a = Math.pow(a + 2, 3);
        for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
            var f = 2 * d / 22050 - 1;
            c[d] = (1 + a) * f / (1 + a * Math.abs(f));
        }
        return c;
    }

    function crunch(a) {
        a = Math.pow(a, 2);
        for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
            var f = 2 * d / 22050 - 1;
            c[d] = (1 + a) * f / (1 + a * Math.abs(f));
        }
        return c;
    }

    function classA(a) {
        var c = new Float32Array(22050);
        a = 10 + 3 * a;
        for (var d = 0; 22050 > d; d += 1) {
            var e = 2 * d / 22050 - 1;
            c[d] = (1 + a) * e / (1 + a * Math.abs(e));
        }
        return c;
    }

    function superClean(a) {
        a = (a + 6) / 4;
        for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
            var e = 2 * d / 22050 - 1;
            c[d] = (1 + a) * e / (1 + a * Math.abs(e));
        }
        return c;
    }

    function vertical(a) {
        a = Math.pow(a + 2, 3);
        for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
            var e = 2 * d / 22050 - 1;
            c[d] = (1 + a) * e / (1 + a * Math.abs(e));
        }
        return c;
    }

    function superFuzz(a) {
        a = Math.pow(a, 3);
        for (var c =
                new Float32Array(22050), d = 0; 22050 > d; d += 1) {
            var e = 2 * d / 22050 - 1;
            c[d] = (1 + a) * e / (1 + a * Math.abs(e));
        }
        return c;
    }

    function NoisyHiGain(a) {
        a /= 153;
        for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1)
            c[d] = (0 > 2 * d / 22050 - 1 ? -1 : 1) * a;
        return c;
    }


    function HiGainModern(a) {
        a = 1 / (1 + Math.pow(a, 4));
        for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
            var e = 2 * d / 22050 - 1;
            c[d] = e / (Math.abs(e) + a);
        }
        return c;
    }

    //  - BEZIER FOR ASYMETRIC CURVE...
// var p0 = {x: 0, y: 100}; //use whatever points you want obviously
// var p1 = {x: 50, y: 100}; // tan
// var p2 = {x: 50, y: 0}; // tan
// var p3 = {x: 100, y: 0};



function bezier(t, p0, p1, p2, p3){
    var cX = 3 * (p1.x - p0.x),
        bX = 3 * (p2.x - p1.x) - cX,
        aX = p3.x - p0.x - cX - bX;
            
    var cY = 3 * (p1.y - p0.y),
        bY = 3 * (p2.y - p1.y) - cY,
        aY = p3.y - p0.y - cY - bY;
            
    var x = (aX * Math.pow(t, 3)) + 
              (bX * Math.pow(t, 2)) + (cX * t) + p0.x;
    var y = (aY * Math.pow(t, 3)) + 
              (bY * Math.pow(t, 2)) + (cY * t) + p0.y;
            
    return {x: x, y: y};
} 

function getBezierCurve() {
    var p0 = {x: 0, y: 100};
var p1 = {x: 10, y: 50};
var p2 = {x: 0, y: 50};
var p3 = {x: 100, y: 0};

   var n_samples = 44100,
   accuracy = 1/n_samples,
   curve = new Float32Array(n_samples),
   index = 0;
  
  curve[index++] = map(p0.y, 0, 100, 1, -1);
  
  // 
  for (var i=0; i<1; i+=accuracy){
    var p = bezier(i, p0, p1, p2, p3);
    curve[index++] = map(p.y, 0, 100, 1, -1);
  }
  
  return curve;
}  
    // END OF WAVE SHAPING FUNCTIONS


    // API
    return {
        buildDistorsionFactories: buildDistorsionFactories,
        distorsionCurves: distorsionCurves
    };
}