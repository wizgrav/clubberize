/* 
* Copyright (c) 2017, Yannis Gravezas All Rights Reserved. Available under the MIT license.
*/

var Transpiler = require("glsl-transpiler");

var transpile = Transpiler({
    uniform: function (name) {
        return "uniforms."+name;
    }
});

function getParameterByName(name, config) {
  var ca = config.split("?");
  config = ca[ca.length - 1];
  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"), results = regex.exec(config);
  return results == null ? "0.0" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function parseArray(s) {
  var a = s.split(","), ret = [];
  a.forEach(function (aa) { ret.push(parseFloat(aa)); });
  return ret;
}

module.exports = window.Clubberize = function (clubber, conf, silent) {
  
  var fn, bands = [];
  var uniforms = {
    iMusic_0: new Float32Array(4),
    iMusic_1: new Float32Array(4),
    iMusic_2: new Float32Array(4),
    iMusic_3: new Float32Array(4)
  };

  var arr = [
    "uniform float iGlobalTime;",
  ];
  
  for(var i=0; i < 4; i++) {
      arr.push("uniform vec4 iMusic_"+i+";");
  } 

  var head = arr.join("\n");

  if(conf instanceof Promise) {
    conf.then(setup);
  } else {
    setup(conf);
  }

  function setup (config) {
    var fields = {}, glsl = [], exec = [""];
    ["red", "green", "blue", "alpha"].forEach(function (k) {
      fields[k] = getParameterByName(k, config);
    });
  
    for(var i=0; i < 4; i++) {
      var ra = parseArray(getParameterByName("r"+i, config));
      var c = {
        from: ra[0], to: ra[1], low: ra[2], high: ra[3],
        template: getParameterByName("t"+i, config),
        smooth: parseArray(getParameterByName("s"+i, config)),
        adapt: parseArray(getParameterByName("a"+i, config))
      };
      bands.push(clubber.band(c));
    }
    
    ["red", "green", "blue", "alpha"].forEach(function (k) {
      var ks = fields[k];
      var gprop = ks.replace(/iMusic\[([0-3])\]/g, "iMusic_\$1");
      glsl.push("float f"+k+"(){ return " + gprop + "; }");
      exec.push("ret.push(f"+k+"());");
    });
    
    var transpiled = transpile(head + glsl.join("\n"));
    var src = "var ret=[];\n" + transpiled + exec.join("\n") + "\nreturn ret;\n";
    if (!silent) console.log(src);
    fn = new Function("uniforms", src);
  }

  var makeClosure = function (obj, cobj) {
    var obj = obj || { time: null, data:  [0, 0, 0, 0] };
    bands.forEach(function (b,i) { 
      var k = "iMusic_"+i;
      obj[k] = uniforms[k] 
    });
    return function (arg1, arg2) {
        if (typeof arg1 === "string") {
            var tp = arg2 ? arg2 : "float";
            var src = transpile([
                head,
                "uniform float time;",
                "uniform vec4 data;",
                "uniform " + tp + " prev;",
                tp + " f(){",
                " return " + arg1.replace(/iMusic\[([0-3])\]/g, "iMusic_\$1") + ";",
                "}"
            ].join("\n"));
            src += "\nreturn f();";
            if (!silent) console.log(src);
    
            var defaults = {
              "float": 0,
              "vec2": [0, 0],
              "vec3": [0, 0, 0],
              "vec4": [0, 0, 0, 0],
              "mat3": [0, 0, 0, 0, 0, 0, 0, 0, 0],
              "mat4": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            };
    
            return makeClosure(obj, { data: defaults[tp], f: new Function("uniforms", src) });
        }
        
        var time = arg1;
        
        if (fn && obj.lastTime !== time) {
          obj.time = obj.iGlobalTime = uniforms.iGlobalTime = time / 1000;
          bands.forEach(function (b,i) { b(uniforms["iMusic_"+i]); });
          obj.data = fn(uniforms);
          obj.lastTime = time;
        }
        if (cobj) {
          obj.prev = cobj.data;
          cobj.data = cobj.f(obj);
          return cobj.data;
        } else {
          return obj.data;
        }
    } 
  }
  
  return makeClosure();
}
