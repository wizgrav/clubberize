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

module.exports = window.Clubberize = function (clubber, config) {
  var fields = {}, glsl = [], exec = [""];
  ["red", "green", "blue", "alpha"].forEach(function (k) {
    fields[k] = getParameterByName(k, config);
  });
  
  var bands = [];
  glsl.push("uniform float iGlobalTime;");
  for(var i=0; i < 4; i++) {
    glsl.push("uniform vec4 iMusic_"+i+";");
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
  
  var transpiled = transpile(glsl.join("\n"));
  var src = "var ret=[];\n" + transpiled + exec.join("\n") + "\nreturn ret;\n";
  console.log(src);
  var fn = new Function("uniforms", src);
  var uniforms = {
    iMusic_0: new Float32Array(4),
    iMusic_1: new Float32Array(4),
    iMusic_2: new Float32Array(4),
    iMusic_3: new Float32Array(4)
  };
  
  return function (time) {
    uniforms.iGlobalTime = time;
    bands.forEach(function (b,i) { b(uniforms["iMusic_"+i]); });
    return fn(uniforms);
  }
}
