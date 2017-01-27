clubberize
========

A helper lib complementing [Clubber Tool](http://wizgrav.github.io/clubber/tool) to enable easy use of [Clubber](http://github.com/wizgrav/clubber/) in js apps, webgl or other.

### Usage ###

### Downloads

To embed this library in your project, include this file (after clubber.js):

* [`clubberize.min.js`](http://wizgrav.github.io/clubberize/dist/clubberize.min.js)

For the unminified version for local development (with source maps), include this file:

* [`clubberize.js`](http://wizgrav.github.io/clubberize/dist/clubberize.js)

### Instructions ###

Clubber tool can export its state using long urls that contain a full serialization of its config. Patches made with the tool provide up to 4 modulators using processors defined in the glsl fields. Glsl makes sense for applying the vectorization technique described in the clubber readme but limits the reuse of the modulators themselves. Clubberize utilizes the awesome [glsl-transpiler](https://github.com/stackgl/glsl-transpiler) to trans compile the rhythm detecting glsl to pure js. A patch from the tool is wrapped in a closure that would be called every render frame to provide the current values of the 4 modulators for it's patch in the form of a 4 element array. The values can then be used in js apps, without the need for webgl.

[You can check an example in codepen](http://codepen.io/wizgrav/pen/PWKNmg)

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

  // Time is passed as seconds to simulate shadertoy's iGlobalTime uniform.
  var data = mods(time/1000);

  // All 4 modulators will be contained in the data 4 element array.
  console.log(data);
}

render(0)
```

## License

This program is free software and is distributed under an [MIT License](LICENSE).
