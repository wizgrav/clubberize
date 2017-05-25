clubberize
========

A helper lib complementing [Clubber Tool](http://wizgrav.github.io/clubber/tool) to enable easy use of [Clubber](http://github.com/wizgrav/clubber/) in js apps, webgl or other. Think of it like a set of vibrating crystals that you can slot in and effortlessly animate your graphics to the tune of music.

### Usage ###

### Downloads

To embed this library in your project, include this file (after clubber.js):

* [`clubberize.min.js`](http://wizgrav.github.io/clubberize/dist/clubberize.min.js)

For the unminified version for local development (with source maps), include this file:

* [`clubberize.js`](http://wizgrav.github.io/clubberize/dist/clubberize.js)

### Instructions ###

[Clubber Tool](http://wizgrav.github.io/clubber/tool) tool can export its state using long urls that contain a full serialization of its config. Patches made with the tool provide up to 4 modulators using processors defined in the glsl fields. Glsl makes sense for applying the vectorization technique described in the clubber readme but limits the reuse of the modulators themselves. 

Clubberize utilizes the awesome [glsl-transpiler](https://github.com/stackgl/glsl-transpiler) to convert the rhythm detecting glsl to pure js. A patch from the tool is wrapped in a closure that should be called every render frame to provide the current values of the 4 modulators for the patch in the form of a 4 element array of floats. These values can then be used in js apps, without the need for webgl.

[You can check an example in codepen](http://codepen.io/wizgrav/pen/PWKNmg) [Another example](http://wizgrav.github.io/copernicus) 

```javascript

// Clubber itself is not part of clubberize so it needs to be setup on it's own.
var clubber = new Clubber();

clubber.listen(document.querySelector("audio"));

// The closure is instantiated by passing the whole state url obtained from clubber tool.
var mods = Clubberize(clubber, "https://wizgrav.github.io/clubber/tool/?tool=1&t0=6234&r0=3,36,64,128&s0=0.1,0.1,0.1,0.1...");

function render (time) {
  window.requestAnimationFrame(render);  

  // Clubber update is separate so we can have one parent and multiple modulator packs
  clubber.update();

  // Time is passed as msec and internally converts to seconds for shadertoy's iGlobalTime uniform.
  var data = mods(time);

  // The values from the 4 modulators will be contained in the data array.
  console.log(data);
}

render(0)
```

A closure generated from a clubber tool url is a parent closure. Further processing on top of the parent closure's modulators is possible. If a string is provided as the first argument when calling the parent closure, it will be interpreted as a glsl oneliner and a new child closure will be returned instead of the current modulator values. 

Calling this closure will automatically update the parent closure's bands and modulator values. the oneliner can access these values as a vec4 "data" uniform( there's also a float "time" uniform available). The second argument specifies the type that the oneliner evaluates to. The type defaults to "float" (for when the oneliner returns a single number) but can, and should, be any glsl type that the oneliner evaluates to like "vec3" which will be returned as an array with 3 elements etc.

The child closures compute and return their oneliner's value instead of the original modulator values. As long as the time provided as the first argument remains the same, the internal clubber bands will only be computed once and cached for the parent and all its child closures. 

```javascript

// The closure is instantiated by passing the whole state url obtained from clubber tool.
var mods = Clubberize(clubber, "https://wizgrav.github.io/clubber/tool/?tool=1&t0=6234&r0=3,36,64,128&s0=0.1,0.1,0.1,0.1...");

// You can have multiple child closures all accessing the same modulators
var filtered1 = mods("mix(data.x, data.y, data.z)", "float");
var filtered2 = mods("vec2(sin(time + data.x), cos(time + data.y))", "vec2");

function render (time) {
  window.requestAnimationFrame(render);  

  // Clubber update is separate so we can have one parent and multiple modulator packs
  clubber.update();

  // No need to call the original as the child closure will automatically update the modulators. 
  // var data = mods(time);

  var float1 = filtered1(time);
  var array2 = filtered2(time);

  console.log(float1, array2);
}

render(0)
```

## License

This program is free software and is distributed under an [MIT License](LICENSE).
