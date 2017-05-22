/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/* 
	* Copyright (c) 2017, Yannis Gravezas All Rights Reserved. Available under the MIT license.
	*/

	var Transpiler = __webpack_require__(1);

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

	module.exports = window.Clubberize = function (clubber, config, silent) {
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
	  if (!silent) console.log(src);
	  var fn = new Function("uniforms", src);
	  var uniforms = {
	    iMusic_0: new Float32Array(4),
	    iMusic_1: new Float32Array(4),
	    iMusic_2: new Float32Array(4),
	    iMusic_3: new Float32Array(4)
	  };
	  
	  function makeFunction(ff) {
	    var obj = obj || { lastTime: null, data: null };
	    return function (arg1, arg2) {
	        if (typeof arg1 === "string" && !ff) {
	            var src = transpile([
	                "uniform float time;",
	                "uniform float data;",
	                (arg2 ? arg2 : "float") + " f(){",
	                " return " + arg1 + ";",
	                "}"
	            ].join("\n"));
	            src += "\nreturn f();";
	            if (!silent) console.log(src);
	  
	            obj.ff = new Function("uniforms", src);
	            return makeFunction(obj);
	        }
	        var time = arg1;
	        uniforms.iGlobalTime = uniforms.time =  time;
	        
	        if (obj.lastTime !== time) {
	          bands.forEach(function (b,i) { b(uniforms["iMusic_"+i]); });
	          obj.data = fn(uniforms);
	          obj.lastTime = time;
	        }
	        uniforms.data = obj.data;
	        return obj.ff ? obj.ff(data) : obj.data;
	    } 
	  }
	  return makeFunction();
	}


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Transform glsl to js.
	 *
	 * @module  glsl-js
	 */

	var GLSL = __webpack_require__(2);

	//static bindings
	GLSL.compile =
	GLSL.string = function (str, opt) {
		return GLSL(opt).compile(str);
	};

	GLSL.stream = __webpack_require__(32);

	module.exports = GLSL;

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Transform glsl to js.
	 *
	 * Dev notes.
	 * glsl-parser often creates identifiers/other nodes by inheriting them from definition.
	 * So by writing som additional info into nodes, note that it will be accessible everywhere below, where initial id is referred by.
	 *
	 * @module  glsl-js/lib/index
	 */

	var Emitter = __webpack_require__(3);
	var inherits = __webpack_require__(4);
	var assert = __webpack_require__(5);
	var parse = __webpack_require__(10);
	var extend = __webpack_require__(22);
	var builtins = __webpack_require__(23);
	var types = __webpack_require__(24);
	var operators = __webpack_require__(26);
	var stdlib = __webpack_require__(27);
	var flatten = __webpack_require__(28);
	var Descriptor = __webpack_require__(25);
	var prepr = __webpack_require__(29);

	var floatRE = /^-?[0-9]*(?:.[0-9]+)?(?:e-?[0-9]+)?$/i;


	/**
	 * Create GLSL codegen instance
	 *
	 * @constructor
	 */
	function GLSL (options) {
		if (!(this instanceof GLSL)) return new GLSL(options);

		extend(this, options);

		this.reset();

		//return function compiler for convenience
		var compile = this.compile.bind(this);
		compile.compiler = this;
		compile.compile = compile;

		return compile;
	};

	inherits(GLSL, Emitter);


	/**
	 * Basic rendering settings
	 */
	GLSL.prototype.optimize = true;
	GLSL.prototype.preprocess = prepr;
	GLSL.prototype.debug = false;


	/**
	 * Operator names
	 */
	GLSL.prototype.operators = operators.operators;


	/**
	 * Type constructors
	 */
	GLSL.prototype.types = types;


	/**
	 * Map of builtins with their types
	 */
	GLSL.prototype.builtins = builtins;


	/**
	 * Parse string arg, return ast.
	 */
	GLSL.prototype.parse = parse;


	/**
	 * Stdlib functions
	 */
	GLSL.prototype.stdlib = stdlib;


	/**
	 * Initialize analysing scopes/vars/types
	 */
	GLSL.prototype.reset = function () {
		if (this.descriptors) this.descriptors.clear();

		//cache of descriptors associated with nodes
		else this.descriptors = new Map();

		//scopes analysed. Each scope is named after the function they are contained in
		this.scopes = {
			global: {
				__name: 'global',
				__parentScope: null
			}
		};

		//hash of registered structures
		this.structs = {

		};

		//collected uniforms
		this.uniforms = {

		};

		//collected varying-s
		this.varyings = {

		};

		//collected attributes
		this.attributes = {

		};

		//collected functions, with output types
		this.functions = {

		};

		//collected stdlib functions need to be included
		this.includes = {

		};

		//current scope of the node processed
		this.currentScope = 'global';
	};


	/**
	 * Compile whether string or tree to js
	 */
	GLSL.prototype.compile = function compile (arg) {
		//apply preprocessor
		if (this.preprocess) {
			if (this.preprocess instanceof Function) {
				arg = this.preprocess(arg);
			}
			else {
				arg = prepr(arg);
			}
		}

		arg = this.parse(arg);

		var result = this.process(arg);

		result = this.stringifyStdlib(this.includes) + '\n' + result;

		return result;
	};


	/**
	 * Process glsl AST node so that it returns descriptor for a node
	 * which by default casts to a string
	 * but contains additional info:
	 * `component` values, if node operates on array
	 * `type` which is returned from the node
	 * `complexity` of the node
	 */
	GLSL.prototype.process = function (node, arg) {
		//we don’t process descriptors
		if (node instanceof String) {
			return node;
		}

		//return cached descriptor, if already was processed
		if (this.descriptors.has(node)) {
			return this.descriptors.get(node);
		}

		//cache simple things as easy descriptors
		if (node == null ||
			typeof node === 'number' ||
			typeof node === 'string' ||
			typeof node === 'boolean') {
			return this.cache(node, Descriptor(node, {complexity: 0}));
		}


		//in some cases glsl-parser returns node object inherited from other node
		//which properties exist only in prototype.
		//Insofar structures take it’s definition type, so should be ignored.
		//See #Structures test for example.
		if (!node.hasOwnProperty('type')) return this.cache(node, Descriptor(null));

		var t = this.transforms[node.type];

		var startCall = false;

		//wrap unknown node
		if (t === undefined) {
			console.warn(`Unknown node type '${node.type}'`);
			return this.cache(node, null);
		}

		if (!t) {
			return this.cache(node, null);
		}

		if (typeof t !== 'function') {
			return this.cache(node, t);
		}

		//do start routines on the first call
		if (!this.started) {
			this.emit('start', node);
			this.started = true;
			startCall = true;
		}

		//apply node serialization
		var result = t.call(this, node, arg);

		if (this.optimize) {
			result = this.optimizeDescriptor(result);
		}

		this.cache(result);

		this.addInclude(result.include);


		//invoke end
		if (startCall) {
			this.started = false;
			this.emit('end', node);
		}

		return result;
	}


	/**
	 * Try to optimize descriptor -
	 * whether expanding components is more profitable than keeping complex version
	 */
	GLSL.prototype.optimizeDescriptor = function (descriptor) {
		//try to optimize
		if (this.optimize && descriptor.optimize !== false) {
			var complexity = descriptor.components.reduce(function (prev, curr) {
					return prev + curr.complexity||0;
				}, 0);

			if (complexity < descriptor.complexity) {
				//expand array, if complexity is ok
				if (descriptor.components && descriptor.components.length > 1) {
					var include = descriptor.components.map(function (c) { return c.include;}, this).filter(Boolean);
					return Descriptor(`[${descriptor.components.join(', ')}]`, extend(descriptor, {
						include: include,
						complexity: complexity
					}));
				}
			}
		}

		return descriptor;
	}


	/**
	 * Cache descriptor, return it
	 */
	GLSL.prototype.cache = function (node, value) {
		if (this.descriptors.has(node)) return this.descriptors.get(node);

		//force descriptor on save
		if (!(value instanceof String)) value = Descriptor(value);

		this.descriptors.set(node, value);

		return this.descriptors.get(node);
	}



	/**
	 * List of transforms for various token types
	 */
	GLSL.prototype.transforms = {
		stmtlist: function (node) {
			if (!node.children.length) return Descriptor(null);

			var result = node.children.map(this.process, this).join('\n');

			return Descriptor(result);
		},

		stmt: function (node) {
			var result = node.children.map(this.process, this).join('');
			if (result) result += ';';

			return Descriptor(result);
		},

		struct: function (node) {
			var structName = node.children[0].data;

			//get args nodes
			var args = node.children.slice(1);
			var argTypes = [];

			//arg names
			var argsList = flatten(args.map(function (arg) {
				assert.equal(arg.type, 'decl', 'Struct statements should be declarations.')

				var decllist = arg.children[arg.children.length - 1];

				assert.equal(decllist.type, 'decllist', 'Struct statement declaration has wrong structure.');

				return decllist.children.map(function (ident) {
					assert.equal(ident.type, 'ident', 'Struct statement contains something other than just identifiers.');
					return ident.data;
				});
			}));

			var argTypes = flatten(args.map(function (arg) {
				var type = arg.children[4].token.data;
				var decllist = arg.children[arg.children.length - 1];
				return decllist.children.map(function () {
					return type;
				});
			}));

			var struct = function struct () {
				var args = arguments;

				var includes = [];

				var fields = argsList.map(function (argName, i) {
					if (args[i]) {
						var initValue = this.process(args[i]);
					}
					else {
						var initValue = this.types[argTypes[i]].call(this, args[i]);
					}
					initValue = this.optimizeDescriptor(initValue);
					includes = includes.concat(initValue.include);
					return Descriptor(`${argName}: ${initValue}`, {
						type: argTypes[i],
						optimize: false,
						components: initValue.components
					});
				}, this);

				return Descriptor(`{\n${fields.join(',\n')}\n}`, {
					type: structName,
					optimize: false,
					include: includes.filter(Boolean),
					components: fields
				});
			}.bind(this);

			//we should set length to be a compatible type constructor
			Object.defineProperty(struct, 'length', {value: argTypes.length});

			//register struct constructor, in a fashion of type constructors
			this.structs[structName] =
			this.types[structName] = struct;

			return Descriptor(null);
		},

		function: function (node) {
			var result = '';

			//if function has no body, that means it is interface for it. We can ignore it.
			if (node.children.length < 3) return Descriptor(null);

			//add function name - just render ident node
			assert.equal(node.children[0].type, 'ident', 'Function should have an identifier.');
			var name = this.process(node.children[0]);

			//add args
			assert.equal(node.children[1].type, 'functionargs', 'Function should have arguments.');
			var args = this.process(node.children[1]);

			//get out type of the function in declaration
			var outType = node.parent.children[4].token.data;


			//add argument types suffix to a fn
			var argTypesSfx = args.components.map(function (arg) {
				return `${arg.type}`;
			}).join('_');

			//if main name is registered - provide type-scoped name of function
			if (this.functions[name] && argTypesSfx) {
				name = `${name}_${argTypesSfx}`;
			}

			//add body
			assert.equal(node.children[2].type, 'stmtlist', 'Function should have a body.');

			//create function body
			result += `function ${name} (${args}) {\n`;
			result += this.process(node.children[2]);
			result = result.replace(/\n/g, '\n\t');
			result += '\n}';

			//get scope back to the global after fn ended
			this.currentScope = this.scopes[this.currentScope].__parentScope.__name;

			//create descriptor
			result = Descriptor(result, {
				type: outType,
				complexity: 999
			});

			//register function descriptor
			this.functions[name] = result;

			return result;
		},

		//function arguments are just shown as a list of ids
		functionargs: function (node) {
			//create new scope - func args are the unique token stream-style detecting a function entry
			var lastScope = this.currentScope;
			var scopeName = (node.parent && node.parent.children[0].data) || 'global';
			this.currentScope = scopeName;

			if (!this.scopes[scopeName]) {
				this.scopes[scopeName] = {
					__parentScope: this.scopes[lastScope],
					__name: scopeName
				};
			}

			var comps = node.children.map(this.process, this);

			return Descriptor(comps.join(', '), {
				components: comps
			});
		},

		//declarations are mapped to var a = n, b = m;
		//decl defines it’s inner placeholders rigidly
		decl: function (node) {
			var result;

			var typeNode = node.children[4];
			var decllist = node.children[5];

			//register structure
			if (node.token.data === 'struct') {
				this.process(typeNode);
				if (!decllist) return Descriptor(null);
			}


			assert(
				decllist.type === 'decllist' ||
				decllist.type === 'function' ||
				decllist.type === 'struct',
			'Decl structure is malicious');


			//declare function as hoisting one
			if (decllist.type === 'function') {
				return this.process(decllist);
			}

			//case of function args - drop var
			if (node.parent.type === 'functionargs') {
				result = this.process(decllist);
				return result;
			}
			//default type, like variable decl etc
			else {
				result = this.process(decllist);
			}

			//prevent empty var declaration
			if (!result || !result.trim()) return Descriptor(null, {
				type: result.type,
				components: result.components,
				optimize: false
			})

			return Descriptor(`var ${result}`, {
				type: result.type,
				components: result.components,
				optimize: false
			});
		},


		//decl list is the same as in js, so just merge identifiers, that's it
		decllist: function (node) {
			var ids = [];
			var lastId = 0;

			//get datatype - it is the 4th children of a decl
			var dataType = node.parent.children[4].token.data;

			//unwrap anonymous structure type
			if (dataType === 'struct') {
				dataType = node.parent.children[4].children[0].data;
			}

			//attribute, uniform, varying etc
			var bindingType = node.parent.children[1].token.data;

			//get dimensions - it is from 5th to the len-1 nodes of a decl
			//that’s in case if dimensions are defined first-class like `float[3] c = 1;`
			//result is [] or [3] or [1, 2] or [4, 5, 5], etc.
			//that is OpenGL 3.0 feature
			var dimensions = [];
			for (var i = 5, l = node.parent.children.length - 1; i < l; i++) {
				dimensions.push(parseInt(node.parent.children[i].children[0].children[0].data));
			}

			for (var i = 0, l = node.children.length; i < l; i++) {
				var child = node.children[i];

				if (child.type === 'ident') {
					var ident = this.process(child);
					ident.type = dataType;
					lastId = ids.push(ident);

					//save identifier to the scope
					this.variable(ident, {
						type: dataType,
						binding: bindingType,
						node: child,
						dimensions: []
					});
				}
				else if (child.type === 'quantifier') {
					//with non-first-class array like `const float c[3]`
					//dimensions might be undefined, so we have to specify them here
					var dimensions = this.variable(ids[lastId - 1]).dimensions;
					dimensions.push(parseInt(child.children[0].children[0].data));
					this.variable(ids[lastId - 1], {dimensions: dimensions});
				}
				else if (child.type === 'expr') {
					var ident = ids[lastId - 1];

					//ignore wrapping literals
					var value = this.process(child);

					//save identifier initial value
					this.variable(ident, {value: value});
				}
				else {
					throw Error('Undefined type in decllist: ' + child.type);
				}
			}

			var functionargs = node.parent.parent.type === 'functionargs';

			//get binding type fn
			var replace = this[bindingType];

			var comps = ids.map(function (ident, i) {
				if (functionargs) return ident;

				var result = this.variable(ident).value;

				//emptyfier, like false or null value
				if (replace !== undefined && !replace) {
					return '';
				}
				//function replacer
				else if (replace instanceof Function) {
					var callResult = replace(ident, this.variable(ident));

					//if call result is something sensible - use it
					if (callResult != null) {
						result = callResult;
					}
				}

				//if result is false/null/empty string - ignore variable definition
				if (!(result+'') && result !== 0) return ident;

				return `${ident} = ${result}`;
			}, this).filter(Boolean);

			var res = Descriptor(comps.join(', '), {
				type: dataType
			});

			return res;
		},

		//placeholders are empty objects - ignore them
		placeholder: function (node) {
			return node.token.data;
		},

		//i++, --i etc
		suffix: function (node) {
			var str = this.process(node.children[0]);
			return Descriptor(str + node.data, {type: str.type});
		},

		//loops are the same as in js
		forloop: function (node) {
			var init = this.process(node.children[0]);
			var cond = this.process(node.children[1]);
			var iter = this.process(node.children[2]);
			var body = this.process(node.children[3]);

			return Descriptor(`for (${init}; ${cond}; ${iter}) {\n${body}\n}`, {

			});
		},

		whileloop: function (node) {
			var cond = this.process(node.children[0]);
			var body = this.process(node.children[1]);

			return Descriptor(`while (${cond}) {\n${body}\n}`, {
			});
		},

		operator: function (node) {
			//access operators - expand to arrays
			if (node.data === '.') {
				var identNode = node.children[0];
				var ident = this.process(identNode);
				var type = ident.type;
				var prop = node.children[1].data;

				//ab.xyz for example
				if (/^[xyzwstpdrgba]{1,4}$/.test(prop)) {
					return this.unswizzle(node);
				}

				return Descriptor(`${ident}.${prop}`, {
					type: type
				});
			}

			throw Error('Unknown operator ' + node.data);

			return Descriptor(null);
		},

		expr: function (node) {
			var result = node.children.map(this.process, this).join('');

			return Descriptor(result);
		},

		precision: function () {
			return Descriptor(null);
		},

		//FIXME: it never creates comments
		comment: function (node) {
			return Descriptor(null)
		},

		preprocessor: function (node) {
			return Descriptor('/* ' + node.token.data + ' */')
		},

		keyword: function (node) {
			if (node.data === 'true' || node.data === 'false') type = 'bool';
			//FIXME: guess every other keyword is a type, isn’t it?
			else type = node.data;
			return Descriptor(node.data, {
				type: type,
				complexity: 0,
				optimize: false
			});
		},

		ident: function (node) {
			//get type of registered var, if possible to find it
			var id = node.token.data;
			var scope = this.scopes[this.currentScope];

			//find the closest scope with the id
			while (scope[id] == null) {
				scope = scope.__parentScope;
				if (!scope) {
					// console.warn(`'${id}' is not defined`);
					break;
				}
			}

			var str = node.data;

			if (scope) {
				var type = scope[id].type;
				var res = Descriptor(str, {
					type: type,
					complexity: 0
				});

				return res;
			}


			//FIXME: guess type more accurately here
			return Descriptor(str, {
				complexity: 0
			});
		},

		return: function (node) {
			var expr = this.process(node.children[0]);
			return Descriptor('return' + (expr.visible ? ' ' + expr : ''), {type: expr.type});
		},

		continue: function () {return Descriptor('continue')},

		break: function () {return Descriptor('break')},

		discard:  function () {return Descriptor('discard()')},

		'do-while': function (node) {
			var exprs = this.process(node.children[0]);
			var cond = this.process(node.children[1]);
			return Descriptor(`do {\n${exprs}\n} while (${cond})`, {
			});
		},

		binary: function (node) {
			var result = '';

			var leftNode = node.children[0];
			var rightNode = node.children[1];
			var left = this.process(leftNode);
			var right = this.process(rightNode);
			var leftType = left.type;
			var rightType = right.type;
			var operator = node.data;

			//data access operator
			if (node.data === '[') {
				//for case of glsl array access like float[3]
				if (this.types[node.type]) {
					return Descriptor(`${leftType}[${right}]`, {
						type: this.types[leftType].type,
						complexity: left.complexity + right.complexity + 1
					});
				}

				//matrix/etc double access a[1][2]
				if (leftNode.type === 'binary') {
					var matNode = leftNode.children[0];
					var matDesc = this.process(matNode);
					var vecSize = this.types[leftType].length;
					var matType = matDesc.type;
					var matSize = this.types[matType].length;
					var outerRight = this.process(leftNode.children[1]);

					var idx = parseFloat(outerRight)|0;
					var offset = parseFloat(right)|0;

					//if number - try to access component
					if (!isNaN(idx) && !isNaN(offset)) {
						return Descriptor(matDesc.components[vecSize*idx + offset], {
							type: 'float',
							complexity: matDesc.complexity + right.complexity + 1
						})
					}

					//if calc - do slice
					else {
						return Descriptor(`${matDesc}[${outerRight} * ${vecSize} + ${right}]`, {
							type: 'float',
							complexity: matDesc.complexity + outerRight.complexity + right.complexity + 2
						});
					}
				}

				//matrix single access a[0] → vec
				if (/mat/.test(leftType)) {
					var size = this.types[leftType].length;
					var start = this.processOperation(right, Descriptor(size), '*');
					var end = this.processOperation(start, Descriptor(size), '+');
					var comps = floatRE.test(start) && floatRE.test(end) ? left.components.slice(start, end) : undefined;
					var res = Descriptor(`${left}.slice(${start}, ${end})`, {
						type: this.types[leftType].type,
						complexity: left.complexity + size,
						components: comps
					});
					res = this.optimizeDescriptor(res);
					return res;
				}

				//detect array access
				//FIXME: double array access here will fail
				var leftVar = this.variable(left);
				var type = leftVar && leftVar.dimensions && leftVar.dimensions.length ? leftType : this.types[leftType].type;

				//something[N] return as is
				return Descriptor(`${left}[${right}]`, {
					type: type,
					complexity: left.complexity + right.complexity + 1
				});
			}

			//default binary operators a × b
			return this.processOperation(left, right, operator);
		},

		assign: function (node) {
			var result = '';
			var operator = node.data;

			var right = this.process(node.children[1]);
			if (node.children[0].type === 'identifier') {
				var left = Descriptor(node.children[0].data, {
					type: right.type,
					optimize: false,
					complexity: 0
				});
			}
			else {
				var left = this.process(node.children[0]);
			}

			var target = left;
			var isSwizzle = node.children[0].type === 'operator' && /^[xyzwstpdrgba]{1,4}$/.test(node.children[0].children[1].data);

			//a *= b.x
			if (!isSwizzle && this.types[right.type].length == 1 && this.types[target.type].length == 1) {
				return Descriptor(`${target} ${operator} ${right}`, {
					type: right.type,
					complexity: target.complexity + 1 + right.complexity
				});
			}

			//FIXME: left can be a structure property set a.prop

			//in cases of setting swizzle - we gotta drop left unswizzle to the right
			if (isSwizzle) {
				var positions = this.swizzlePositions(node.children[0].children[1].data);
				var len = this.types[this.process(node.children[0].children[0]).type].length;
				var ids = Array(len).fill('null');

				for (var i = 0; i < positions.length; i++) {
					ids[positions[i]] = i;
				}

				target = Descriptor(node.children[0].children[0].data, {
					type: right.type,
					optimize: false
				});

				//a.wy *= a.zx →
				//a = [null, 1, null, 0].map(function (idx, i) {
				//	return idx == null ? gl_position[i] : this[idx];
				//}, a.wy * a.zx)
				if (positions.length > 1) {
					//*=
					if (operator.length > 1) {
						var subOperator = operator.slice(0, -1);
						right = this.processOperation(this.unswizzle(node.children[0]), right, subOperator);
						right = this.optimizeDescriptor(right);
					}

					var comps = Array(len);
					for (var i = 0; i < len; i++) {
						comps[i] = Descriptor(`${target}[${i}]`, {
							type: 'float',
							complexity: 1
						});
					}
					for (var i = 0; i < positions.length; i++) {
						comps[positions[i]] = right.components[i];
					}

					right = Descriptor(
						`[${ids.join(', ')}].map(function (idx, i) { return idx == null ? ${target}[i] : this[idx]; }, ${right})`, {
							type: right.type,
							complexity: len*4 + right.complexity,
							include: right.include,
							components: comps
					});
					right = this.optimizeDescriptor(right);

					return Descriptor(`${target} = ${right}`, {
						type: right.type,
						optimize: false,
						include: right.include
					});
				}
				//a.x *= b → a[0] *= b
				else {
					return Descriptor(`${target}[${positions[0]}] ${operator} ${right}`, {
						type: right.type,
						optimize: false
					});
				}
			}

			//`a *= x` → `a = a * x`
			else if (operator.length > 1) {
				var subOperator = operator.slice(0, -1);
				right = this.processOperation(left, right, subOperator);
				right = this.optimizeDescriptor(right);
			}

			//simple assign, =
			return Descriptor(`${target} = ${right}`, {
				type: right.type,
				complexity: 1
			});
		},

		ternary: function (node) {
			var cond = this.process(node.children[0]);
			var a = this.process(node.children[1]);
			var b = this.process(node.children[2]);

			return Descriptor(`${cond} ? ${a} : ${b}`, {type: a.type});
		},

		unary: function (node) {
			var str = this.process(node.children[0]);

			var complexity = str.complexity + 1;

			//ignore + operator, we dont need to cast data
			if (node.data === '+') {
				//++x
				if (node.children[0].type === 'unary') {
					return Descriptor(node.data + str, {type: str.type, complexity: complexity});
				}
				else if (node.children[0].parent.type === 'unary') {
					return Descriptor(node.data + str, {type: str.type, complexity: complexity});
				}

				//+x
				return Descriptor(str);
			}
			return Descriptor(node.data + str, {type: str.type, complexity: complexity});
		},

		//gl_Position, gl_FragColor, gl_FragPosition etc
		builtin: function (node) {
			return Descriptor(node.data, {
				type: this.builtins[node.data],
				complexity: 0
			});
		},

		call: function (node) {
			var args = node.children.slice(1);
			var argValues = args.map(this.process, this);
			var argTypes = argValues.map(function (arg) {
				return arg.type
			}, this);

			//if first node is an access, like a.b() - treat special access-call case
			if (node.children[0].data === '.') {
				var methodNode = node.children[0].children[1];
				var holderNode = node.children[0].children[0];
				var methodName = this.process(methodNode);
				var holderName = this.process(holderNode);
				var type = holderName.type;

				//if length call - return length of a vector
				//vecN.length → N
				if (methodName == 'length' && this.types[type].length > 1) {
					return Descriptor(this.types[type].length, {
						type: 'int',
						complexity: 0
					});
				}

				var callName = Descriptor(`${holderName}.${methodName}`, {
					type: methodName.type,
					complexity: holderName.complexity + methodName.complexity
				});
			}

			//first node is caller: float(), float[2](), vec4[1][3][4]() etc.
			else {
				var callName = this.process(node.children[0]);
			}

			//if first child of the call is array call - expand array
			//FIXME: in cases of anonymously created arrays of arrays, outside of declarations, there might be an issue: `vec4[3][3](0,1)`
			if (node.children[0].data === '[') {
				var dimensions = [];
				var keywordNode = node.children[0];
				while (keywordNode.type != 'keyword') {
					dimensions.push(parseInt(keywordNode.children[1].data));
					keywordNode = keywordNode.children[0];
				}

				//if nested type is primitive - expand literals without wrapping
				var value = '';
				if (this.types[callName]) {
					value += args.map(this.process, this).join(', ');
				} else {
					value += callName + '(';
					value += args.map(this.process, this).join(', ');
					value += ')';
				}

				//wrap array init expression
				return Descriptor(this.wrapDimensions(argValues, dimensions.reverse()), {
					type: callName.type,
					complexity: 999
				});
			}

			//else treat as function/constructor call
			else {
				if (this.debug) {
					if (callName == 'print') {
						var args = argValues.map(function (a) {
							return a+':'+a.type;
						});
						console.log.apply(console, args);
						return Descriptor(null);
					}

					if (callName == 'show') {
						console.log.apply(console, argValues.map(function (a) {
							return a;
						}));
						return Descriptor(null);
					}
				}

				//struct(), vec2(), float()
				if (this.types[callName]) {
					return this.types[callName].apply(this, args);
				}

				//someFn()
				else {
					var type, optimize = true;

					//registered fn()
					if (this.functions[callName]) {
						var sfx = argTypes.join('_');
						if (sfx && this.functions[`${callName}_${sfx}`]) {
							type = this.functions[`${callName}_${sfx}`].type;
							callName = Descriptor(`${callName}_${sfx}`, {
								complexity: callName.complexity
							});
						}
						else if (this.functions[callName]) {
							type = this.functions[callName].type;
						}
					}

					//stdlib()
					else if (this.stdlib[callName]) {
						this.addInclude(callName);

						//if callname is other than included name - redirect call name
						if (this.stdlib[callName].name) {
							callName = this.stdlib[callName].name;
						}

						//add other includes if any
						this.addInclude(this.stdlib[callName].include);

						type = this.stdlib[callName].type;
						if (type instanceof Function) type = type.call(this, node);
					}

					if (!type) {
						//Unable to guess the type of '${callName}' as it is undefined. Guess it returns the type of the first argument.
						type = this.process(node.children[1]).type;
						optimize = false;
					}
					var res = Descriptor(`${callName}(${argValues.join(', ')})`, {
						type: type || callName.type,
						complexity: 999 /* argValues.reduce(function (prev, curr) {
							return curr.complexity+prev;
						}, callName.complexity||999) */,
						optimize: optimize
					});

					return res;
				}
			}
		},

		literal: function (node) {
			//convert 023 → 0o23
			if (/^0[0-9]+/.test(node.data)) {
				node.data = '0o' + node.data.slice(1);
			}

			//if special format - parse it as int, else - return unchanged
			var result = /^[0-9][xob]/.test(node.data) ? Number(node.data) : node.data;

			//guess type - as far in js any number tends to be a float, give priority to it
			//in order to avoid unnecessary types alignment
			var type;
			if (/true|false/i.test(node.data)) type = 'bool';
			else if (/^[0-9]+$/.test(node.data) > 0) type = 'int';
			else if (floatRE.test(node.data)) type = 'float';
			return Descriptor(result, {type: type, complexity: 0});
		},

		//ifs are the same as js
		if: function (node) {
			var cond = this.process(node.children[0]);
			var ifBody = this.process(node.children[1]);

			var result = `if (${cond}) {\n${ifBody}\n}`;

			if (node.children.length > 1) {
				var elseBody = this.process(node.children[2]);
				if (elseBody.visible) result += ` else {\n${elseBody}\n}`;
			}

			return Descriptor(result, {
				type: 'float'
			});
		},

		//grouped expression like a = (a - 1);
		group: function (node) {
			//children are like (1, 2, 3) - does not make a big sense
			//the last one is always taken as a result
			var children = node.children.map(this.process, this);

			var result = '(' + children.join(', ') + ')';
			var last = children[children.length - 1];

			//each component therefore should be wrapped to group as well
			//FIXME: single-multiplocation ops like (x*34.) + 1. are possible to be unwrapped, providing that they are of the most precedence.
			last.components = last.components.map(function (comp) {
				//if component contains no operations (we not smartly guess that each op adds to complexity) - keep component as is.
				if (comp.complexity === 1) return comp;

				//otherwise wrap it, as it may contain precedences etc.
				return Descriptor('(' + comp + ')', comp);
			});

			return Descriptor(result, {
				type: last.type,
				components: last.components,
				complexity: children.reduce(function (prev, curr) {return prev+curr.complexity||0}, 0)
			});
		}

		// switch: function () {
		//FIXME: not implemented in glsl-parser
		// }
	}

	/**
	 * Return list if ids for swizzle letters
	 */
	GLSL.prototype.swizzlePositions = function (prop) {
		var swizzles = 'xyzwstpdrgba';
		var positions = [];
		for (var i = 0, l = prop.length; i < l; i++) {
			var letter = prop[i];
			var position = swizzles.indexOf(letter) % 4;
			positions.push(position);
		}
		return positions;
	};

	/**
	 * Transform access node to a swizzle construct
	 * ab.xyz → [ab[0], ab[1], ab[2]]
	 */
	GLSL.prototype.unswizzle = function (node) {
		var identNode = node.children[0];

		var ident = this.process(identNode);
		var type = ident.type;
		var prop = node.children[1].data;

		var positions = this.swizzlePositions(prop),
			args = positions.map(function (position) {
				//[0, 1].yx → [0, 1]
				// a.yx → [a[1], a[0]]
				return ident.components[position];
			});
		//a.x → a[0]
		if (args.length === 1) {
			if (args[0] == null) console.warn(`Cannot unswizzle '${ident.type}(${ident}).${prop}': ${prop} is outside the type range.`);
			var result = Descriptor(args[0]||'undefined', {
				type: 'float',
				complexity: 1
			});
			return result;
		}

		//vec2 a.xy → a
		if (args.length === this.types[type].length && positions.every(function (position, i) { return position === i})) {
			return ident;
		}

		var complexity = args.length * ident.complexity;

		//a.yz → [1, 2].map(function(x) { return this[x]; }, a)
		var result = Descriptor(`[${positions.join(', ')}].map(function (x, i) { return this[x]}, ${ident})`, {
			complexity: args.length*2,
			type: `vec${args.length}`,
			components: args
		});

		result = this.optimizeDescriptor(result);

		return result;
	}


	/**
	 * Get/set variable from/to a [current] scope
	 */
	GLSL.prototype.variable = function (ident, data, scope) {
		if (!scope) scope = this.currentScope;

		//set/update variable
		if (data) {
			//create variable
			if (!this.scopes[scope][ident]) {
				this.scopes[scope][ident] = {};
			}

			var variable = extend(this.scopes[scope][ident], data);

			//preset default value for a variable, if undefined
			if (data.value == null) {
				if (this.types[variable.type]) {
					//for sampler types pass name as arg
					if (/sampler|image/.test(variable.type)) {
						variable.value = this.types[variable.type].call(this, ident);
					}
					else {
						variable.value = this.types[variable.type].call(this);
					}
				}

				//some unknown types
				else {
					variable.value = variable.type + `()`;
				}

				variable.value = this.optimizeDescriptor(variable.value);

				variable.value = this.wrapDimensions(variable.value, variable.dimensions);
			}
			//if value is passed - we guess that variable knows how to init itself
			//usually it is `call` node rendered
			// else {
			// }


			//just set an id
			if (variable.id == null) variable.id = ident;

			//save scope
			if (variable.scope == null) variable.scope = this.scopes[scope];

			//save variable to the collections
			if (variable.binding === 'uniform') {
				this.uniforms[ident] = variable;
			}
			if (variable.binding === 'attribute') {
				this.attributes[ident] = variable;
			}
			if (variable.binding === 'varying') {
				this.varyings[ident] = variable;
			}

			return variable;
		}

		//get varialbe
		return this.scopes[scope][ident];
	};


	/**
	 * Return value wrapped to the proper number of dimensions
	 */
	GLSL.prototype.wrapDimensions = function (value, dimensions) {
		//wrap value to dimensions
		if (dimensions.length) {
			if (!Array.isArray(value)) value = [value];

			value = dimensions.reduceRight(function (value, curr) {
				var result = [];

				//for each dimension number - wrap result n times
				var prevVal, val;
				for (var i = 0; i < curr; i++) {
					val = value[i] == null ? prevVal : value[i];
					prevVal = val;
					result.push(val);
				}
				return `[${result.join(', ')}]`;
			}, value);
		}

		return value;
	};


	/**
	 * Operator renderer
	 */
	GLSL.prototype.processOperation = operators;


	/**
	 * Add include, pass optional prop object
	 */
	GLSL.prototype.addInclude = function (name, prop) {
		if (!name) return;

		if (Array.isArray(name)) {
			return name.forEach(function (i) {
				this.addInclude(i)
			}, this);
		}

		if (!(name instanceof String) && typeof name === 'object') {
			for (var subName in name) {
				this.addInclude(subName, name[subName]);
			}
			return;
		}

		if (!prop) {
			if (!this.includes[name]) this.includes[name] = true;
		}
		else {
			if (!this.includes[name] || this.includes[name] === true) this.includes[name] = {};
			this.includes[name][prop] = true;
		}
	}


	/**
	 * Get stdlib source for includes
	 */
	GLSL.prototype.stringifyStdlib = function (includes) {
		if (!includes) includes = this.includes;
		var methods = [];

		for (var meth in includes) {
			//eg vecN
			var result = this.stdlib[meth].toString();
			methods.push(result);

			//eg vecN.operation
			if (includes[meth]) {
				for (var prop in includes[meth]) {
					if (!this.stdlib[meth][prop]) {
						console.warn(`Cannot find '${meth}.${prop}' in stdlib`);
						continue;
					}
					methods.push(`${meth}.${prop} = ${this.stdlib[meth][prop].toString()}`);
				}
			}
		}

		return methods.join('\n');
	};


	module.exports = GLSL;

/***/ },
/* 3 */
/***/ function(module, exports) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	function EventEmitter() {
	  this._events = this._events || {};
	  this._maxListeners = this._maxListeners || undefined;
	}
	module.exports = EventEmitter;

	// Backwards-compat with node 0.10.x
	EventEmitter.EventEmitter = EventEmitter;

	EventEmitter.prototype._events = undefined;
	EventEmitter.prototype._maxListeners = undefined;

	// By default EventEmitters will print a warning if more than 10 listeners are
	// added to it. This is a useful default which helps finding memory leaks.
	EventEmitter.defaultMaxListeners = 10;

	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	EventEmitter.prototype.setMaxListeners = function(n) {
	  if (!isNumber(n) || n < 0 || isNaN(n))
	    throw TypeError('n must be a positive number');
	  this._maxListeners = n;
	  return this;
	};

	EventEmitter.prototype.emit = function(type) {
	  var er, handler, len, args, i, listeners;

	  if (!this._events)
	    this._events = {};

	  // If there is no 'error' event listener then throw.
	  if (type === 'error') {
	    if (!this._events.error ||
	        (isObject(this._events.error) && !this._events.error.length)) {
	      er = arguments[1];
	      if (er instanceof Error) {
	        throw er; // Unhandled 'error' event
	      } else {
	        // At least give some kind of context to the user
	        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
	        err.context = er;
	        throw err;
	      }
	    }
	  }

	  handler = this._events[type];

	  if (isUndefined(handler))
	    return false;

	  if (isFunction(handler)) {
	    switch (arguments.length) {
	      // fast cases
	      case 1:
	        handler.call(this);
	        break;
	      case 2:
	        handler.call(this, arguments[1]);
	        break;
	      case 3:
	        handler.call(this, arguments[1], arguments[2]);
	        break;
	      // slower
	      default:
	        args = Array.prototype.slice.call(arguments, 1);
	        handler.apply(this, args);
	    }
	  } else if (isObject(handler)) {
	    args = Array.prototype.slice.call(arguments, 1);
	    listeners = handler.slice();
	    len = listeners.length;
	    for (i = 0; i < len; i++)
	      listeners[i].apply(this, args);
	  }

	  return true;
	};

	EventEmitter.prototype.addListener = function(type, listener) {
	  var m;

	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  if (!this._events)
	    this._events = {};

	  // To avoid recursion in the case that type === "newListener"! Before
	  // adding it to the listeners, first emit "newListener".
	  if (this._events.newListener)
	    this.emit('newListener', type,
	              isFunction(listener.listener) ?
	              listener.listener : listener);

	  if (!this._events[type])
	    // Optimize the case of one listener. Don't need the extra array object.
	    this._events[type] = listener;
	  else if (isObject(this._events[type]))
	    // If we've already got an array, just append.
	    this._events[type].push(listener);
	  else
	    // Adding the second element, need to change to array.
	    this._events[type] = [this._events[type], listener];

	  // Check for listener leak
	  if (isObject(this._events[type]) && !this._events[type].warned) {
	    if (!isUndefined(this._maxListeners)) {
	      m = this._maxListeners;
	    } else {
	      m = EventEmitter.defaultMaxListeners;
	    }

	    if (m && m > 0 && this._events[type].length > m) {
	      this._events[type].warned = true;
	      console.error('(node) warning: possible EventEmitter memory ' +
	                    'leak detected. %d listeners added. ' +
	                    'Use emitter.setMaxListeners() to increase limit.',
	                    this._events[type].length);
	      if (typeof console.trace === 'function') {
	        // not supported in IE 10
	        console.trace();
	      }
	    }
	  }

	  return this;
	};

	EventEmitter.prototype.on = EventEmitter.prototype.addListener;

	EventEmitter.prototype.once = function(type, listener) {
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  var fired = false;

	  function g() {
	    this.removeListener(type, g);

	    if (!fired) {
	      fired = true;
	      listener.apply(this, arguments);
	    }
	  }

	  g.listener = listener;
	  this.on(type, g);

	  return this;
	};

	// emits a 'removeListener' event iff the listener was removed
	EventEmitter.prototype.removeListener = function(type, listener) {
	  var list, position, length, i;

	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');

	  if (!this._events || !this._events[type])
	    return this;

	  list = this._events[type];
	  length = list.length;
	  position = -1;

	  if (list === listener ||
	      (isFunction(list.listener) && list.listener === listener)) {
	    delete this._events[type];
	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);

	  } else if (isObject(list)) {
	    for (i = length; i-- > 0;) {
	      if (list[i] === listener ||
	          (list[i].listener && list[i].listener === listener)) {
	        position = i;
	        break;
	      }
	    }

	    if (position < 0)
	      return this;

	    if (list.length === 1) {
	      list.length = 0;
	      delete this._events[type];
	    } else {
	      list.splice(position, 1);
	    }

	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);
	  }

	  return this;
	};

	EventEmitter.prototype.removeAllListeners = function(type) {
	  var key, listeners;

	  if (!this._events)
	    return this;

	  // not listening for removeListener, no need to emit
	  if (!this._events.removeListener) {
	    if (arguments.length === 0)
	      this._events = {};
	    else if (this._events[type])
	      delete this._events[type];
	    return this;
	  }

	  // emit removeListener for all listeners on all events
	  if (arguments.length === 0) {
	    for (key in this._events) {
	      if (key === 'removeListener') continue;
	      this.removeAllListeners(key);
	    }
	    this.removeAllListeners('removeListener');
	    this._events = {};
	    return this;
	  }

	  listeners = this._events[type];

	  if (isFunction(listeners)) {
	    this.removeListener(type, listeners);
	  } else if (listeners) {
	    // LIFO order
	    while (listeners.length)
	      this.removeListener(type, listeners[listeners.length - 1]);
	  }
	  delete this._events[type];

	  return this;
	};

	EventEmitter.prototype.listeners = function(type) {
	  var ret;
	  if (!this._events || !this._events[type])
	    ret = [];
	  else if (isFunction(this._events[type]))
	    ret = [this._events[type]];
	  else
	    ret = this._events[type].slice();
	  return ret;
	};

	EventEmitter.prototype.listenerCount = function(type) {
	  if (this._events) {
	    var evlistener = this._events[type];

	    if (isFunction(evlistener))
	      return 1;
	    else if (evlistener)
	      return evlistener.length;
	  }
	  return 0;
	};

	EventEmitter.listenerCount = function(emitter, type) {
	  return emitter.listenerCount(type);
	};

	function isFunction(arg) {
	  return typeof arg === 'function';
	}

	function isNumber(arg) {
	  return typeof arg === 'number';
	}

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}

	function isUndefined(arg) {
	  return arg === void 0;
	}


/***/ },
/* 4 */
/***/ function(module, exports) {

	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    ctor.prototype = Object.create(superCtor.prototype, {
	      constructor: {
	        value: ctor,
	        enumerable: false,
	        writable: true,
	        configurable: true
	      }
	    });
	  };
	} else {
	  // old school shim for old browsers
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    var TempCtor = function () {}
	    TempCtor.prototype = superCtor.prototype
	    ctor.prototype = new TempCtor()
	    ctor.prototype.constructor = ctor
	  }
	}


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {'use strict';

	// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
	// original notice:

	/*!
	 * The buffer module from node.js, for the browser.
	 *
	 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
	 * @license  MIT
	 */
	function compare(a, b) {
	  if (a === b) {
	    return 0;
	  }

	  var x = a.length;
	  var y = b.length;

	  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
	    if (a[i] !== b[i]) {
	      x = a[i];
	      y = b[i];
	      break;
	    }
	  }

	  if (x < y) {
	    return -1;
	  }
	  if (y < x) {
	    return 1;
	  }
	  return 0;
	}
	function isBuffer(b) {
	  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
	    return global.Buffer.isBuffer(b);
	  }
	  return !!(b != null && b._isBuffer);
	}

	// based on node assert, original notice:

	// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
	//
	// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
	//
	// Originally from narwhal.js (http://narwhaljs.org)
	// Copyright (c) 2009 Thomas Robinson <280north.com>
	//
	// Permission is hereby granted, free of charge, to any person obtaining a copy
	// of this software and associated documentation files (the 'Software'), to
	// deal in the Software without restriction, including without limitation the
	// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
	// sell copies of the Software, and to permit persons to whom the Software is
	// furnished to do so, subject to the following conditions:
	//
	// The above copyright notice and this permission notice shall be included in
	// all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
	// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
	// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

	var util = __webpack_require__(6);
	var hasOwn = Object.prototype.hasOwnProperty;
	var pSlice = Array.prototype.slice;
	var functionsHaveNames = (function () {
	  return function foo() {}.name === 'foo';
	}());
	function pToString (obj) {
	  return Object.prototype.toString.call(obj);
	}
	function isView(arrbuf) {
	  if (isBuffer(arrbuf)) {
	    return false;
	  }
	  if (typeof global.ArrayBuffer !== 'function') {
	    return false;
	  }
	  if (typeof ArrayBuffer.isView === 'function') {
	    return ArrayBuffer.isView(arrbuf);
	  }
	  if (!arrbuf) {
	    return false;
	  }
	  if (arrbuf instanceof DataView) {
	    return true;
	  }
	  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
	    return true;
	  }
	  return false;
	}
	// 1. The assert module provides functions that throw
	// AssertionError's when particular conditions are not met. The
	// assert module must conform to the following interface.

	var assert = module.exports = ok;

	// 2. The AssertionError is defined in assert.
	// new assert.AssertionError({ message: message,
	//                             actual: actual,
	//                             expected: expected })

	var regex = /\s*function\s+([^\(\s]*)\s*/;
	// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
	function getName(func) {
	  if (!util.isFunction(func)) {
	    return;
	  }
	  if (functionsHaveNames) {
	    return func.name;
	  }
	  var str = func.toString();
	  var match = str.match(regex);
	  return match && match[1];
	}
	assert.AssertionError = function AssertionError(options) {
	  this.name = 'AssertionError';
	  this.actual = options.actual;
	  this.expected = options.expected;
	  this.operator = options.operator;
	  if (options.message) {
	    this.message = options.message;
	    this.generatedMessage = false;
	  } else {
	    this.message = getMessage(this);
	    this.generatedMessage = true;
	  }
	  var stackStartFunction = options.stackStartFunction || fail;
	  if (Error.captureStackTrace) {
	    Error.captureStackTrace(this, stackStartFunction);
	  } else {
	    // non v8 browsers so we can have a stacktrace
	    var err = new Error();
	    if (err.stack) {
	      var out = err.stack;

	      // try to strip useless frames
	      var fn_name = getName(stackStartFunction);
	      var idx = out.indexOf('\n' + fn_name);
	      if (idx >= 0) {
	        // once we have located the function frame
	        // we need to strip out everything before it (and its line)
	        var next_line = out.indexOf('\n', idx + 1);
	        out = out.substring(next_line + 1);
	      }

	      this.stack = out;
	    }
	  }
	};

	// assert.AssertionError instanceof Error
	util.inherits(assert.AssertionError, Error);

	function truncate(s, n) {
	  if (typeof s === 'string') {
	    return s.length < n ? s : s.slice(0, n);
	  } else {
	    return s;
	  }
	}
	function inspect(something) {
	  if (functionsHaveNames || !util.isFunction(something)) {
	    return util.inspect(something);
	  }
	  var rawname = getName(something);
	  var name = rawname ? ': ' + rawname : '';
	  return '[Function' +  name + ']';
	}
	function getMessage(self) {
	  return truncate(inspect(self.actual), 128) + ' ' +
	         self.operator + ' ' +
	         truncate(inspect(self.expected), 128);
	}

	// At present only the three keys mentioned above are used and
	// understood by the spec. Implementations or sub modules can pass
	// other keys to the AssertionError's constructor - they will be
	// ignored.

	// 3. All of the following functions must throw an AssertionError
	// when a corresponding condition is not met, with a message that
	// may be undefined if not provided.  All assertion methods provide
	// both the actual and expected values to the assertion error for
	// display purposes.

	function fail(actual, expected, message, operator, stackStartFunction) {
	  throw new assert.AssertionError({
	    message: message,
	    actual: actual,
	    expected: expected,
	    operator: operator,
	    stackStartFunction: stackStartFunction
	  });
	}

	// EXTENSION! allows for well behaved errors defined elsewhere.
	assert.fail = fail;

	// 4. Pure assertion tests whether a value is truthy, as determined
	// by !!guard.
	// assert.ok(guard, message_opt);
	// This statement is equivalent to assert.equal(true, !!guard,
	// message_opt);. To test strictly for the value true, use
	// assert.strictEqual(true, guard, message_opt);.

	function ok(value, message) {
	  if (!value) fail(value, true, message, '==', assert.ok);
	}
	assert.ok = ok;

	// 5. The equality assertion tests shallow, coercive equality with
	// ==.
	// assert.equal(actual, expected, message_opt);

	assert.equal = function equal(actual, expected, message) {
	  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
	};

	// 6. The non-equality assertion tests for whether two objects are not equal
	// with != assert.notEqual(actual, expected, message_opt);

	assert.notEqual = function notEqual(actual, expected, message) {
	  if (actual == expected) {
	    fail(actual, expected, message, '!=', assert.notEqual);
	  }
	};

	// 7. The equivalence assertion tests a deep equality relation.
	// assert.deepEqual(actual, expected, message_opt);

	assert.deepEqual = function deepEqual(actual, expected, message) {
	  if (!_deepEqual(actual, expected, false)) {
	    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
	  }
	};

	assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
	  if (!_deepEqual(actual, expected, true)) {
	    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
	  }
	};

	function _deepEqual(actual, expected, strict, memos) {
	  // 7.1. All identical values are equivalent, as determined by ===.
	  if (actual === expected) {
	    return true;
	  } else if (isBuffer(actual) && isBuffer(expected)) {
	    return compare(actual, expected) === 0;

	  // 7.2. If the expected value is a Date object, the actual value is
	  // equivalent if it is also a Date object that refers to the same time.
	  } else if (util.isDate(actual) && util.isDate(expected)) {
	    return actual.getTime() === expected.getTime();

	  // 7.3 If the expected value is a RegExp object, the actual value is
	  // equivalent if it is also a RegExp object with the same source and
	  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
	  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
	    return actual.source === expected.source &&
	           actual.global === expected.global &&
	           actual.multiline === expected.multiline &&
	           actual.lastIndex === expected.lastIndex &&
	           actual.ignoreCase === expected.ignoreCase;

	  // 7.4. Other pairs that do not both pass typeof value == 'object',
	  // equivalence is determined by ==.
	  } else if ((actual === null || typeof actual !== 'object') &&
	             (expected === null || typeof expected !== 'object')) {
	    return strict ? actual === expected : actual == expected;

	  // If both values are instances of typed arrays, wrap their underlying
	  // ArrayBuffers in a Buffer each to increase performance
	  // This optimization requires the arrays to have the same type as checked by
	  // Object.prototype.toString (aka pToString). Never perform binary
	  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
	  // bit patterns are not identical.
	  } else if (isView(actual) && isView(expected) &&
	             pToString(actual) === pToString(expected) &&
	             !(actual instanceof Float32Array ||
	               actual instanceof Float64Array)) {
	    return compare(new Uint8Array(actual.buffer),
	                   new Uint8Array(expected.buffer)) === 0;

	  // 7.5 For all other Object pairs, including Array objects, equivalence is
	  // determined by having the same number of owned properties (as verified
	  // with Object.prototype.hasOwnProperty.call), the same set of keys
	  // (although not necessarily the same order), equivalent values for every
	  // corresponding key, and an identical 'prototype' property. Note: this
	  // accounts for both named and indexed properties on Arrays.
	  } else if (isBuffer(actual) !== isBuffer(expected)) {
	    return false;
	  } else {
	    memos = memos || {actual: [], expected: []};

	    var actualIndex = memos.actual.indexOf(actual);
	    if (actualIndex !== -1) {
	      if (actualIndex === memos.expected.indexOf(expected)) {
	        return true;
	      }
	    }

	    memos.actual.push(actual);
	    memos.expected.push(expected);

	    return objEquiv(actual, expected, strict, memos);
	  }
	}

	function isArguments(object) {
	  return Object.prototype.toString.call(object) == '[object Arguments]';
	}

	function objEquiv(a, b, strict, actualVisitedObjects) {
	  if (a === null || a === undefined || b === null || b === undefined)
	    return false;
	  // if one is a primitive, the other must be same
	  if (util.isPrimitive(a) || util.isPrimitive(b))
	    return a === b;
	  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
	    return false;
	  var aIsArgs = isArguments(a);
	  var bIsArgs = isArguments(b);
	  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
	    return false;
	  if (aIsArgs) {
	    a = pSlice.call(a);
	    b = pSlice.call(b);
	    return _deepEqual(a, b, strict);
	  }
	  var ka = objectKeys(a);
	  var kb = objectKeys(b);
	  var key, i;
	  // having the same number of owned properties (keys incorporates
	  // hasOwnProperty)
	  if (ka.length !== kb.length)
	    return false;
	  //the same set of keys (although not necessarily the same order),
	  ka.sort();
	  kb.sort();
	  //~~~cheap key test
	  for (i = ka.length - 1; i >= 0; i--) {
	    if (ka[i] !== kb[i])
	      return false;
	  }
	  //equivalent values for every corresponding key, and
	  //~~~possibly expensive deep test
	  for (i = ka.length - 1; i >= 0; i--) {
	    key = ka[i];
	    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
	      return false;
	  }
	  return true;
	}

	// 8. The non-equivalence assertion tests for any deep inequality.
	// assert.notDeepEqual(actual, expected, message_opt);

	assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
	  if (_deepEqual(actual, expected, false)) {
	    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
	  }
	};

	assert.notDeepStrictEqual = notDeepStrictEqual;
	function notDeepStrictEqual(actual, expected, message) {
	  if (_deepEqual(actual, expected, true)) {
	    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
	  }
	}


	// 9. The strict equality assertion tests strict equality, as determined by ===.
	// assert.strictEqual(actual, expected, message_opt);

	assert.strictEqual = function strictEqual(actual, expected, message) {
	  if (actual !== expected) {
	    fail(actual, expected, message, '===', assert.strictEqual);
	  }
	};

	// 10. The strict non-equality assertion tests for strict inequality, as
	// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

	assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
	  if (actual === expected) {
	    fail(actual, expected, message, '!==', assert.notStrictEqual);
	  }
	};

	function expectedException(actual, expected) {
	  if (!actual || !expected) {
	    return false;
	  }

	  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
	    return expected.test(actual);
	  }

	  try {
	    if (actual instanceof expected) {
	      return true;
	    }
	  } catch (e) {
	    // Ignore.  The instanceof check doesn't work for arrow functions.
	  }

	  if (Error.isPrototypeOf(expected)) {
	    return false;
	  }

	  return expected.call({}, actual) === true;
	}

	function _tryBlock(block) {
	  var error;
	  try {
	    block();
	  } catch (e) {
	    error = e;
	  }
	  return error;
	}

	function _throws(shouldThrow, block, expected, message) {
	  var actual;

	  if (typeof block !== 'function') {
	    throw new TypeError('"block" argument must be a function');
	  }

	  if (typeof expected === 'string') {
	    message = expected;
	    expected = null;
	  }

	  actual = _tryBlock(block);

	  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
	            (message ? ' ' + message : '.');

	  if (shouldThrow && !actual) {
	    fail(actual, expected, 'Missing expected exception' + message);
	  }

	  var userProvidedMessage = typeof message === 'string';
	  var isUnwantedException = !shouldThrow && util.isError(actual);
	  var isUnexpectedException = !shouldThrow && actual && !expected;

	  if ((isUnwantedException &&
	      userProvidedMessage &&
	      expectedException(actual, expected)) ||
	      isUnexpectedException) {
	    fail(actual, expected, 'Got unwanted exception' + message);
	  }

	  if ((shouldThrow && actual && expected &&
	      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
	    throw actual;
	  }
	}

	// 11. Expected to throw an error:
	// assert.throws(block, Error_opt, message_opt);

	assert.throws = function(block, /*optional*/error, /*optional*/message) {
	  _throws(true, block, error, message);
	};

	// EXTENSION! This is annoying to write outside this module.
	assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
	  _throws(false, block, error, message);
	};

	assert.ifError = function(err) { if (err) throw err; };

	var objectKeys = Object.keys || function (obj) {
	  var keys = [];
	  for (var key in obj) {
	    if (hasOwn.call(obj, key)) keys.push(key);
	  }
	  return keys;
	};

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, process) {// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	var formatRegExp = /%[sdj%]/g;
	exports.format = function(f) {
	  if (!isString(f)) {
	    var objects = [];
	    for (var i = 0; i < arguments.length; i++) {
	      objects.push(inspect(arguments[i]));
	    }
	    return objects.join(' ');
	  }

	  var i = 1;
	  var args = arguments;
	  var len = args.length;
	  var str = String(f).replace(formatRegExp, function(x) {
	    if (x === '%%') return '%';
	    if (i >= len) return x;
	    switch (x) {
	      case '%s': return String(args[i++]);
	      case '%d': return Number(args[i++]);
	      case '%j':
	        try {
	          return JSON.stringify(args[i++]);
	        } catch (_) {
	          return '[Circular]';
	        }
	      default:
	        return x;
	    }
	  });
	  for (var x = args[i]; i < len; x = args[++i]) {
	    if (isNull(x) || !isObject(x)) {
	      str += ' ' + x;
	    } else {
	      str += ' ' + inspect(x);
	    }
	  }
	  return str;
	};


	// Mark that a method should not be used.
	// Returns a modified function which warns once by default.
	// If --no-deprecation is set, then it is a no-op.
	exports.deprecate = function(fn, msg) {
	  // Allow for deprecating things in the process of starting up.
	  if (isUndefined(global.process)) {
	    return function() {
	      return exports.deprecate(fn, msg).apply(this, arguments);
	    };
	  }

	  if (process.noDeprecation === true) {
	    return fn;
	  }

	  var warned = false;
	  function deprecated() {
	    if (!warned) {
	      if (process.throwDeprecation) {
	        throw new Error(msg);
	      } else if (process.traceDeprecation) {
	        console.trace(msg);
	      } else {
	        console.error(msg);
	      }
	      warned = true;
	    }
	    return fn.apply(this, arguments);
	  }

	  return deprecated;
	};


	var debugs = {};
	var debugEnviron;
	exports.debuglog = function(set) {
	  if (isUndefined(debugEnviron))
	    debugEnviron = process.env.NODE_DEBUG || '';
	  set = set.toUpperCase();
	  if (!debugs[set]) {
	    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
	      var pid = process.pid;
	      debugs[set] = function() {
	        var msg = exports.format.apply(exports, arguments);
	        console.error('%s %d: %s', set, pid, msg);
	      };
	    } else {
	      debugs[set] = function() {};
	    }
	  }
	  return debugs[set];
	};


	/**
	 * Echos the value of a value. Trys to print the value out
	 * in the best way possible given the different types.
	 *
	 * @param {Object} obj The object to print out.
	 * @param {Object} opts Optional options object that alters the output.
	 */
	/* legacy: obj, showHidden, depth, colors*/
	function inspect(obj, opts) {
	  // default options
	  var ctx = {
	    seen: [],
	    stylize: stylizeNoColor
	  };
	  // legacy...
	  if (arguments.length >= 3) ctx.depth = arguments[2];
	  if (arguments.length >= 4) ctx.colors = arguments[3];
	  if (isBoolean(opts)) {
	    // legacy...
	    ctx.showHidden = opts;
	  } else if (opts) {
	    // got an "options" object
	    exports._extend(ctx, opts);
	  }
	  // set default options
	  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
	  if (isUndefined(ctx.depth)) ctx.depth = 2;
	  if (isUndefined(ctx.colors)) ctx.colors = false;
	  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
	  if (ctx.colors) ctx.stylize = stylizeWithColor;
	  return formatValue(ctx, obj, ctx.depth);
	}
	exports.inspect = inspect;


	// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
	inspect.colors = {
	  'bold' : [1, 22],
	  'italic' : [3, 23],
	  'underline' : [4, 24],
	  'inverse' : [7, 27],
	  'white' : [37, 39],
	  'grey' : [90, 39],
	  'black' : [30, 39],
	  'blue' : [34, 39],
	  'cyan' : [36, 39],
	  'green' : [32, 39],
	  'magenta' : [35, 39],
	  'red' : [31, 39],
	  'yellow' : [33, 39]
	};

	// Don't use 'blue' not visible on cmd.exe
	inspect.styles = {
	  'special': 'cyan',
	  'number': 'yellow',
	  'boolean': 'yellow',
	  'undefined': 'grey',
	  'null': 'bold',
	  'string': 'green',
	  'date': 'magenta',
	  // "name": intentionally not styling
	  'regexp': 'red'
	};


	function stylizeWithColor(str, styleType) {
	  var style = inspect.styles[styleType];

	  if (style) {
	    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
	           '\u001b[' + inspect.colors[style][1] + 'm';
	  } else {
	    return str;
	  }
	}


	function stylizeNoColor(str, styleType) {
	  return str;
	}


	function arrayToHash(array) {
	  var hash = {};

	  array.forEach(function(val, idx) {
	    hash[val] = true;
	  });

	  return hash;
	}


	function formatValue(ctx, value, recurseTimes) {
	  // Provide a hook for user-specified inspect functions.
	  // Check that value is an object with an inspect function on it
	  if (ctx.customInspect &&
	      value &&
	      isFunction(value.inspect) &&
	      // Filter out the util module, it's inspect function is special
	      value.inspect !== exports.inspect &&
	      // Also filter out any prototype objects using the circular check.
	      !(value.constructor && value.constructor.prototype === value)) {
	    var ret = value.inspect(recurseTimes, ctx);
	    if (!isString(ret)) {
	      ret = formatValue(ctx, ret, recurseTimes);
	    }
	    return ret;
	  }

	  // Primitive types cannot have properties
	  var primitive = formatPrimitive(ctx, value);
	  if (primitive) {
	    return primitive;
	  }

	  // Look up the keys of the object.
	  var keys = Object.keys(value);
	  var visibleKeys = arrayToHash(keys);

	  if (ctx.showHidden) {
	    keys = Object.getOwnPropertyNames(value);
	  }

	  // IE doesn't make error fields non-enumerable
	  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
	  if (isError(value)
	      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
	    return formatError(value);
	  }

	  // Some type of object without properties can be shortcutted.
	  if (keys.length === 0) {
	    if (isFunction(value)) {
	      var name = value.name ? ': ' + value.name : '';
	      return ctx.stylize('[Function' + name + ']', 'special');
	    }
	    if (isRegExp(value)) {
	      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
	    }
	    if (isDate(value)) {
	      return ctx.stylize(Date.prototype.toString.call(value), 'date');
	    }
	    if (isError(value)) {
	      return formatError(value);
	    }
	  }

	  var base = '', array = false, braces = ['{', '}'];

	  // Make Array say that they are Array
	  if (isArray(value)) {
	    array = true;
	    braces = ['[', ']'];
	  }

	  // Make functions say that they are functions
	  if (isFunction(value)) {
	    var n = value.name ? ': ' + value.name : '';
	    base = ' [Function' + n + ']';
	  }

	  // Make RegExps say that they are RegExps
	  if (isRegExp(value)) {
	    base = ' ' + RegExp.prototype.toString.call(value);
	  }

	  // Make dates with properties first say the date
	  if (isDate(value)) {
	    base = ' ' + Date.prototype.toUTCString.call(value);
	  }

	  // Make error with message first say the error
	  if (isError(value)) {
	    base = ' ' + formatError(value);
	  }

	  if (keys.length === 0 && (!array || value.length == 0)) {
	    return braces[0] + base + braces[1];
	  }

	  if (recurseTimes < 0) {
	    if (isRegExp(value)) {
	      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
	    } else {
	      return ctx.stylize('[Object]', 'special');
	    }
	  }

	  ctx.seen.push(value);

	  var output;
	  if (array) {
	    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
	  } else {
	    output = keys.map(function(key) {
	      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
	    });
	  }

	  ctx.seen.pop();

	  return reduceToSingleString(output, base, braces);
	}


	function formatPrimitive(ctx, value) {
	  if (isUndefined(value))
	    return ctx.stylize('undefined', 'undefined');
	  if (isString(value)) {
	    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
	                                             .replace(/'/g, "\\'")
	                                             .replace(/\\"/g, '"') + '\'';
	    return ctx.stylize(simple, 'string');
	  }
	  if (isNumber(value))
	    return ctx.stylize('' + value, 'number');
	  if (isBoolean(value))
	    return ctx.stylize('' + value, 'boolean');
	  // For some reason typeof null is "object", so special case here.
	  if (isNull(value))
	    return ctx.stylize('null', 'null');
	}


	function formatError(value) {
	  return '[' + Error.prototype.toString.call(value) + ']';
	}


	function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
	  var output = [];
	  for (var i = 0, l = value.length; i < l; ++i) {
	    if (hasOwnProperty(value, String(i))) {
	      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
	          String(i), true));
	    } else {
	      output.push('');
	    }
	  }
	  keys.forEach(function(key) {
	    if (!key.match(/^\d+$/)) {
	      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
	          key, true));
	    }
	  });
	  return output;
	}


	function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
	  var name, str, desc;
	  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
	  if (desc.get) {
	    if (desc.set) {
	      str = ctx.stylize('[Getter/Setter]', 'special');
	    } else {
	      str = ctx.stylize('[Getter]', 'special');
	    }
	  } else {
	    if (desc.set) {
	      str = ctx.stylize('[Setter]', 'special');
	    }
	  }
	  if (!hasOwnProperty(visibleKeys, key)) {
	    name = '[' + key + ']';
	  }
	  if (!str) {
	    if (ctx.seen.indexOf(desc.value) < 0) {
	      if (isNull(recurseTimes)) {
	        str = formatValue(ctx, desc.value, null);
	      } else {
	        str = formatValue(ctx, desc.value, recurseTimes - 1);
	      }
	      if (str.indexOf('\n') > -1) {
	        if (array) {
	          str = str.split('\n').map(function(line) {
	            return '  ' + line;
	          }).join('\n').substr(2);
	        } else {
	          str = '\n' + str.split('\n').map(function(line) {
	            return '   ' + line;
	          }).join('\n');
	        }
	      }
	    } else {
	      str = ctx.stylize('[Circular]', 'special');
	    }
	  }
	  if (isUndefined(name)) {
	    if (array && key.match(/^\d+$/)) {
	      return str;
	    }
	    name = JSON.stringify('' + key);
	    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
	      name = name.substr(1, name.length - 2);
	      name = ctx.stylize(name, 'name');
	    } else {
	      name = name.replace(/'/g, "\\'")
	                 .replace(/\\"/g, '"')
	                 .replace(/(^"|"$)/g, "'");
	      name = ctx.stylize(name, 'string');
	    }
	  }

	  return name + ': ' + str;
	}


	function reduceToSingleString(output, base, braces) {
	  var numLinesEst = 0;
	  var length = output.reduce(function(prev, cur) {
	    numLinesEst++;
	    if (cur.indexOf('\n') >= 0) numLinesEst++;
	    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
	  }, 0);

	  if (length > 60) {
	    return braces[0] +
	           (base === '' ? '' : base + '\n ') +
	           ' ' +
	           output.join(',\n  ') +
	           ' ' +
	           braces[1];
	  }

	  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
	}


	// NOTE: These type checking functions intentionally don't use `instanceof`
	// because it is fragile and can be easily faked with `Object.create()`.
	function isArray(ar) {
	  return Array.isArray(ar);
	}
	exports.isArray = isArray;

	function isBoolean(arg) {
	  return typeof arg === 'boolean';
	}
	exports.isBoolean = isBoolean;

	function isNull(arg) {
	  return arg === null;
	}
	exports.isNull = isNull;

	function isNullOrUndefined(arg) {
	  return arg == null;
	}
	exports.isNullOrUndefined = isNullOrUndefined;

	function isNumber(arg) {
	  return typeof arg === 'number';
	}
	exports.isNumber = isNumber;

	function isString(arg) {
	  return typeof arg === 'string';
	}
	exports.isString = isString;

	function isSymbol(arg) {
	  return typeof arg === 'symbol';
	}
	exports.isSymbol = isSymbol;

	function isUndefined(arg) {
	  return arg === void 0;
	}
	exports.isUndefined = isUndefined;

	function isRegExp(re) {
	  return isObject(re) && objectToString(re) === '[object RegExp]';
	}
	exports.isRegExp = isRegExp;

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}
	exports.isObject = isObject;

	function isDate(d) {
	  return isObject(d) && objectToString(d) === '[object Date]';
	}
	exports.isDate = isDate;

	function isError(e) {
	  return isObject(e) &&
	      (objectToString(e) === '[object Error]' || e instanceof Error);
	}
	exports.isError = isError;

	function isFunction(arg) {
	  return typeof arg === 'function';
	}
	exports.isFunction = isFunction;

	function isPrimitive(arg) {
	  return arg === null ||
	         typeof arg === 'boolean' ||
	         typeof arg === 'number' ||
	         typeof arg === 'string' ||
	         typeof arg === 'symbol' ||  // ES6 symbol
	         typeof arg === 'undefined';
	}
	exports.isPrimitive = isPrimitive;

	exports.isBuffer = __webpack_require__(8);

	function objectToString(o) {
	  return Object.prototype.toString.call(o);
	}


	function pad(n) {
	  return n < 10 ? '0' + n.toString(10) : n.toString(10);
	}


	var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
	              'Oct', 'Nov', 'Dec'];

	// 26 Feb 16:19:34
	function timestamp() {
	  var d = new Date();
	  var time = [pad(d.getHours()),
	              pad(d.getMinutes()),
	              pad(d.getSeconds())].join(':');
	  return [d.getDate(), months[d.getMonth()], time].join(' ');
	}


	// log is just a thin wrapper to console.log that prepends a timestamp
	exports.log = function() {
	  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
	};


	/**
	 * Inherit the prototype methods from one constructor into another.
	 *
	 * The Function.prototype.inherits from lang.js rewritten as a standalone
	 * function (not on Function.prototype). NOTE: If this file is to be loaded
	 * during bootstrapping this function needs to be rewritten using some native
	 * functions as prototype setup using normal JavaScript does not work as
	 * expected during bootstrapping (see mirror.js in r114903).
	 *
	 * @param {function} ctor Constructor function which needs to inherit the
	 *     prototype.
	 * @param {function} superCtor Constructor function to inherit prototype from.
	 */
	exports.inherits = __webpack_require__(9);

	exports._extend = function(origin, add) {
	  // Don't do anything if add isn't an object
	  if (!add || !isObject(add)) return origin;

	  var keys = Object.keys(add);
	  var i = keys.length;
	  while (i--) {
	    origin[keys[i]] = add[keys[i]];
	  }
	  return origin;
	};

	function hasOwnProperty(obj, prop) {
	  return Object.prototype.hasOwnProperty.call(obj, prop);
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(7)))

/***/ },
/* 7 */
/***/ function(module, exports) {

	// shim for using process in browser
	var process = module.exports = {};

	// cached from whatever global is present so that test runners that stub it
	// don't break things.  But we need to wrap it in a try catch in case it is
	// wrapped in strict mode code which doesn't define any globals.  It's inside a
	// function because try/catches deoptimize in certain engines.

	var cachedSetTimeout;
	var cachedClearTimeout;

	function defaultSetTimout() {
	    throw new Error('setTimeout has not been defined');
	}
	function defaultClearTimeout () {
	    throw new Error('clearTimeout has not been defined');
	}
	(function () {
	    try {
	        if (typeof setTimeout === 'function') {
	            cachedSetTimeout = setTimeout;
	        } else {
	            cachedSetTimeout = defaultSetTimout;
	        }
	    } catch (e) {
	        cachedSetTimeout = defaultSetTimout;
	    }
	    try {
	        if (typeof clearTimeout === 'function') {
	            cachedClearTimeout = clearTimeout;
	        } else {
	            cachedClearTimeout = defaultClearTimeout;
	        }
	    } catch (e) {
	        cachedClearTimeout = defaultClearTimeout;
	    }
	} ())
	function runTimeout(fun) {
	    if (cachedSetTimeout === setTimeout) {
	        //normal enviroments in sane situations
	        return setTimeout(fun, 0);
	    }
	    // if setTimeout wasn't available but was latter defined
	    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
	        cachedSetTimeout = setTimeout;
	        return setTimeout(fun, 0);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedSetTimeout(fun, 0);
	    } catch(e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
	            return cachedSetTimeout.call(null, fun, 0);
	        } catch(e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
	            return cachedSetTimeout.call(this, fun, 0);
	        }
	    }


	}
	function runClearTimeout(marker) {
	    if (cachedClearTimeout === clearTimeout) {
	        //normal enviroments in sane situations
	        return clearTimeout(marker);
	    }
	    // if clearTimeout wasn't available but was latter defined
	    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
	        cachedClearTimeout = clearTimeout;
	        return clearTimeout(marker);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedClearTimeout(marker);
	    } catch (e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
	            return cachedClearTimeout.call(null, marker);
	        } catch (e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
	            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
	            return cachedClearTimeout.call(this, marker);
	        }
	    }



	}
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;

	function cleanUpNextTick() {
	    if (!draining || !currentQueue) {
	        return;
	    }
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}

	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = runTimeout(cleanUpNextTick);
	    draining = true;

	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    runClearTimeout(timeout);
	}

	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        runTimeout(drainQueue);
	    }
	};

	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};

	function noop() {}

	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;

	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};

	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ },
/* 8 */
/***/ function(module, exports) {

	module.exports = function isBuffer(arg) {
	  return arg && typeof arg === 'object'
	    && typeof arg.copy === 'function'
	    && typeof arg.fill === 'function'
	    && typeof arg.readUInt8 === 'function';
	}

/***/ },
/* 9 */
/***/ function(module, exports) {

	if (typeof Object.create === 'function') {
	  // implementation from standard node.js 'util' module
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    ctor.prototype = Object.create(superCtor.prototype, {
	      constructor: {
	        value: ctor,
	        enumerable: false,
	        writable: true,
	        configurable: true
	      }
	    });
	  };
	} else {
	  // old school shim for old browsers
	  module.exports = function inherits(ctor, superCtor) {
	    ctor.super_ = superCtor
	    var TempCtor = function () {}
	    TempCtor.prototype = superCtor.prototype
	    ctor.prototype = new TempCtor()
	    ctor.prototype.constructor = ctor
	  }
	}


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * A wrapper for glsl-parser
	 *
	 * @module  glsl-js/lib/parse
	 */

	var glslParse = __webpack_require__(11);
	var tokenize = __webpack_require__(15);

	function parse(arg) {
		//ready AST
		if (typeof arg === 'object' && arg.children) return arg;

		//convert string to tokens
		if (typeof arg === 'string') {
			arg = tokenize(arg);
		}

		//convert tokens to ast
		if (Array.isArray(arg)) {
			arg = glslParse(arg)
		}

		return arg;
	}

	module.exports = parse;

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var parse = __webpack_require__(12)

	module.exports = parseArray

	function parseArray(tokens) {
	  var parser = parse()

	  for (var i = 0; i < tokens.length; i++) {
	    parser(tokens[i])
	  }

	  return parser(null)
	}


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = parser

	var full_parse_expr = __webpack_require__(13)
	  , Scope = __webpack_require__(14)

	// singleton!
	var Advance = new Object

	var DEBUG = false

	var _ = 0
	  , IDENT = _++
	  , STMT = _++
	  , STMTLIST = _++
	  , STRUCT = _++
	  , FUNCTION = _++
	  , FUNCTIONARGS = _++
	  , DECL = _++
	  , DECLLIST = _++
	  , FORLOOP = _++
	  , WHILELOOP = _++
	  , IF = _++
	  , EXPR = _++
	  , PRECISION = _++
	  , COMMENT = _++
	  , PREPROCESSOR = _++
	  , KEYWORD = _++
	  , KEYWORD_OR_IDENT = _++
	  , RETURN = _++
	  , BREAK = _++
	  , CONTINUE = _++
	  , DISCARD = _++
	  , DOWHILELOOP = _++
	  , PLACEHOLDER = _++
	  , QUANTIFIER = _++

	var DECL_ALLOW_ASSIGN = 0x1
	  , DECL_ALLOW_COMMA = 0x2
	  , DECL_REQUIRE_NAME = 0x4
	  , DECL_ALLOW_INVARIANT = 0x8
	  , DECL_ALLOW_STORAGE = 0x10
	  , DECL_NO_INOUT = 0x20
	  , DECL_ALLOW_STRUCT = 0x40
	  , DECL_STATEMENT = 0xFF
	  , DECL_FUNCTION = DECL_STATEMENT & ~(DECL_ALLOW_ASSIGN | DECL_ALLOW_COMMA | DECL_NO_INOUT | DECL_ALLOW_INVARIANT | DECL_REQUIRE_NAME)
	  , DECL_STRUCT = DECL_STATEMENT & ~(DECL_ALLOW_ASSIGN | DECL_ALLOW_INVARIANT | DECL_ALLOW_STORAGE | DECL_ALLOW_STRUCT)

	var QUALIFIERS = ['const', 'attribute', 'uniform', 'varying']

	var NO_ASSIGN_ALLOWED = false
	  , NO_COMMA_ALLOWED = false

	// map of tokens to stmt types
	var token_map = {
	    'block-comment': COMMENT
	  , 'line-comment': COMMENT
	  , 'preprocessor': PREPROCESSOR
	}

	// map of stmt types to human
	var stmt_type = _ = [
	    'ident'
	  , 'stmt'
	  , 'stmtlist'
	  , 'struct'
	  , 'function'
	  , 'functionargs'
	  , 'decl'
	  , 'decllist'
	  , 'forloop'
	  , 'whileloop'
	  , 'if'
	  , 'expr'
	  , 'precision'
	  , 'comment'
	  , 'preprocessor'
	  , 'keyword'
	  , 'keyword_or_ident'
	  , 'return'
	  , 'break'
	  , 'continue'
	  , 'discard'
	  , 'do-while'
	  , 'placeholder'
	  , 'quantifier'
	]

	function parser() {
	  var stmtlist = n(STMTLIST)
	    , stmt = n(STMT)
	    , decllist = n(DECLLIST)
	    , precision = n(PRECISION)
	    , ident = n(IDENT)
	    , keyword_or_ident = n(KEYWORD_OR_IDENT)
	    , fn = n(FUNCTION)
	    , fnargs = n(FUNCTIONARGS)
	    , forstmt = n(FORLOOP)
	    , ifstmt = n(IF)
	    , whilestmt = n(WHILELOOP)
	    , returnstmt = n(RETURN)
	    , dowhilestmt = n(DOWHILELOOP)
	    , quantifier = n(QUANTIFIER)

	  var parse_struct
	    , parse_precision
	    , parse_quantifier
	    , parse_forloop
	    , parse_if
	    , parse_return
	    , parse_whileloop
	    , parse_dowhileloop
	    , parse_function
	    , parse_function_args

	  var check = arguments.length ? [].slice.call(arguments) : []
	    , complete = false
	    , ended = false
	    , depth = 0
	    , state = []
	    , nodes = []
	    , tokens = []
	    , whitespace = []
	    , errored = false
	    , program
	    , token
	    , node

	  // setup state
	  state.shift = special_shift
	  state.unshift = special_unshift
	  state.fake = special_fake
	  state.unexpected = unexpected
	  state.scope = new Scope(state)
	  state.create_node = function() {
	    var n = mknode(IDENT, token)
	    n.parent = reader.program
	    return n
	  }

	  setup_stative_parsers()

	  // setup root node
	  node = stmtlist()
	  node.expecting = '(eof)'
	  node.mode = STMTLIST
	  node.token = {type: '(program)', data: '(program)'}
	  program = node

	  reader.program = program
	  reader.scope = function(scope) {
	    if(arguments.length === 1) {
	      state.scope = scope
	    }
	    return state.scope
	  }

	  state.unshift(node)
	  return reader

	  function reader(data) {
	    if (data === null) {
	      return end(), program
	    }

	    nodes = []
	    write(data)
	    return nodes
	  }

	  // stream functions ---------------------------------------------

	  function write(input) {
	    if(input.type === 'whitespace' || input.type === 'line-comment' || input.type === 'block-comment') {

	      whitespace.push(input)
	      return
	    }
	    tokens.push(input)
	    token = token || tokens[0]

	    if(token && whitespace.length) {
	      token.preceding = token.preceding || []
	      token.preceding = token.preceding.concat(whitespace)
	      whitespace = []
	    }

	    while(take()) switch(state[0].mode) {
	      case STMT: parse_stmt(); break
	      case STMTLIST: parse_stmtlist(); break
	      case DECL: parse_decl(); break
	      case DECLLIST: parse_decllist(); break
	      case EXPR: parse_expr(); break
	      case STRUCT: parse_struct(true, true); break
	      case PRECISION: parse_precision(); break
	      case IDENT: parse_ident(); break
	      case KEYWORD: parse_keyword(); break
	      case KEYWORD_OR_IDENT: parse_keyword_or_ident(); break
	      case FUNCTION: parse_function(); break
	      case FUNCTIONARGS: parse_function_args(); break
	      case FORLOOP: parse_forloop(); break
	      case WHILELOOP: parse_whileloop(); break
	      case DOWHILELOOP: parse_dowhileloop(); break
	      case RETURN: parse_return(); break
	      case IF: parse_if(); break
	      case QUANTIFIER: parse_quantifier(); break
	    }
	  }

	  function end(tokens) {
	    if(arguments.length) {
	      write(tokens)
	    }

	    if(state.length > 1) {
	      unexpected('unexpected EOF')
	      return
	    }

	    complete = true
	  }

	  function take() {
	    if(errored || !state.length)
	      return false

	    return (token = tokens[0])
	  }

	  // ----- state manipulation --------

	  function special_fake(x) {
	    state.unshift(x)
	    state.shift()
	  }

	  function special_unshift(_node, add_child) {
	    _node.parent = state[0]

	    var ret = [].unshift.call(this, _node)

	    add_child = add_child === undefined ? true : add_child

	    if(DEBUG) {
	      var pad = ''
	      for(var i = 0, len = this.length - 1; i < len; ++i) {
	        pad += ' |'
	      }
	      console.log(pad, '\\'+_node.type, _node.token.data)
	    }

	    if(add_child && node !== _node) node.children.push(_node)
	    node = _node

	    return ret
	  }

	  function special_shift() {
	    var _node = [].shift.call(this)
	      , okay = check[this.length]
	      , emit = false

	    if(DEBUG) {
	      var pad = ''
	      for(var i = 0, len = this.length; i < len; ++i) {
	        pad += ' |'
	      }
	      console.log(pad, '/'+_node.type)
	    }

	    if(check.length) {
	      if(typeof check[0] === 'function') {
	        emit = check[0](_node)
	      } else if(okay !== undefined) {
	        emit = okay.test ? okay.test(_node.type) : okay === _node.type
	      }
	    } else {
	      emit = true
	    }

	    if(emit && !errored) nodes.push(_node)

	    node = _node.parent
	    return _node
	  }

	  // parse states ---------------

	  function parse_stmtlist() {
	    // determine the type of the statement
	    // and then start parsing
	    return stative(
	      function() { state.scope.enter(); return Advance }
	    , normal_mode
	    )()

	    function normal_mode() {
	      if(token.data === state[0].expecting) {
	        return state.scope.exit(), state.shift()
	      }
	      switch(token.type) {
	        case 'preprocessor':
	          state.fake(adhoc())
	          tokens.shift()
	        return
	        default:
	          state.unshift(stmt())
	        return
	      }
	    }
	  }

	  function parse_stmt() {
	    if(state[0].brace) {
	      if(token.data !== '}') {
	        return unexpected('expected `}`, got '+token.data)
	      }
	      state[0].brace = false
	      return tokens.shift(), state.shift()
	    }
	    switch(token.type) {
	      case 'eof': return got_eof()
	      case 'keyword':
	        switch(token.data) {
	          case 'for': return state.unshift(forstmt());
	          case 'if': return state.unshift(ifstmt());
	          case 'while': return state.unshift(whilestmt());
	          case 'do': return state.unshift(dowhilestmt());
	          case 'break': return state.fake(mknode(BREAK, token)), tokens.shift()
	          case 'continue': return state.fake(mknode(CONTINUE, token)), tokens.shift()
	          case 'discard': return state.fake(mknode(DISCARD, token)), tokens.shift()
	          case 'return': return state.unshift(returnstmt());
	          case 'precision': return state.unshift(precision());
	        }
	        return state.unshift(decl(DECL_STATEMENT))
	      case 'ident':
	        var lookup
	        if(lookup = state.scope.find(token.data)) {
	          if(lookup.parent.type === 'struct') {
	            // this is strictly untrue, you could have an
	            // expr that starts with a struct constructor.
	            //      ... sigh
	            return state.unshift(decl(DECL_STATEMENT))
	          }
	          return state.unshift(expr(';'))
	        }
	      case 'operator':
	        if(token.data === '{') {
	          state[0].brace = true
	          var n = stmtlist()
	          n.expecting = '}'
	          return tokens.shift(), state.unshift(n)
	        }
	        if(token.data === ';') {
	          return tokens.shift(), state.shift()
	        }
	      default: return state.unshift(expr(';'))
	    }
	  }

	  function got_eof() {
	    if (ended) errored = true
	    ended = true
	    return state.shift()
	  }

	  function parse_decl() {
	    var stmt = state[0]

	    return stative(
	      invariant_or_not,
	      storage_or_not,
	      parameter_or_not,
	      precision_or_not,
	      struct_or_type,
	      maybe_name,
	      maybe_lparen,     // lparen means we're a function
	      is_decllist,
	      done
	    )()

	    function invariant_or_not() {
	      if(token.data === 'invariant') {
	        if(stmt.flags & DECL_ALLOW_INVARIANT) {
	          state.unshift(keyword())
	          return Advance
	        } else {
	          return unexpected('`invariant` is not allowed here')
	        }
	      } else {
	        state.fake(mknode(PLACEHOLDER, {data: '', position: token.position}))
	        return Advance
	      }
	    }

	    function storage_or_not() {
	      if(is_storage(token)) {
	        if(stmt.flags & DECL_ALLOW_STORAGE) {
	          state.unshift(keyword())
	          return Advance
	        } else {
	          return unexpected('storage is not allowed here')
	        }
	      } else {
	        state.fake(mknode(PLACEHOLDER, {data: '', position: token.position}))
	        return Advance
	      }
	    }

	    function parameter_or_not() {
	      if(is_parameter(token)) {
	        if(!(stmt.flags & DECL_NO_INOUT)) {
	          state.unshift(keyword())
	          return Advance
	        } else {
	          return unexpected('parameter is not allowed here')
	        }
	      } else {
	        state.fake(mknode(PLACEHOLDER, {data: '', position: token.position}))
	        return Advance
	      }
	    }

	    function precision_or_not() {
	      if(is_precision(token)) {
	        state.unshift(keyword())
	        return Advance
	      } else {
	        state.fake(mknode(PLACEHOLDER, {data: '', position: token.position}))
	        return Advance
	      }
	    }

	    function struct_or_type() {
	      if(token.data === 'struct') {
	        if(!(stmt.flags & DECL_ALLOW_STRUCT)) {
	          return unexpected('cannot nest structs')
	        }
	        state.unshift(struct())
	        return Advance
	      }

	      if(token.type === 'keyword') {
	        state.unshift(keyword())
	        return Advance
	      }

	      var lookup = state.scope.find(token.data)

	      if(lookup) {
	        state.fake(Object.create(lookup))
	        tokens.shift()
	        return Advance
	      }
	      return unexpected('expected user defined type, struct or keyword, got '+token.data)
	    }

	    function maybe_name() {
	      if(token.data === ',' && !(stmt.flags & DECL_ALLOW_COMMA)) {
	        return state.shift()
	      }

	      if(token.data === '[') {
	        // oh lord.
	        state.unshift(quantifier())
	        return
	      }

	      if(token.data === ')') return state.shift()

	      if(token.data === ';') {
	        return stmt.stage + 3
	      }

	      if(token.type !== 'ident' && token.type !== 'builtin') {
	        return unexpected('expected identifier, got '+token.data)
	      }

	      stmt.collected_name = tokens.shift()
	      return Advance
	    }

	    function maybe_lparen() {
	      if(token.data === '(') {
	        tokens.unshift(stmt.collected_name)
	        delete stmt.collected_name
	        state.unshift(fn())
	        return stmt.stage + 2
	      }
	      return Advance
	    }

	    function is_decllist() {
	      tokens.unshift(stmt.collected_name)
	      delete stmt.collected_name
	      state.unshift(decllist())
	      return Advance
	    }

	    function done() {
	      return state.shift()
	    }
	  }

	  function parse_decllist() {
	    // grab ident

	    if(token.type === 'ident') {
	      var name = token.data
	      state.unshift(ident())
	      state.scope.define(name)
	      return
	    }

	    if(token.type === 'operator') {

	      if(token.data === ',') {
	        // multi-decl!
	        if(!(state[1].flags & DECL_ALLOW_COMMA)) {
	          return state.shift()
	        }

	        return tokens.shift()
	      } else if(token.data === '=') {
	        if(!(state[1].flags & DECL_ALLOW_ASSIGN)) return unexpected('`=` is not allowed here.')

	        tokens.shift()

	        state.unshift(expr(',', ';'))
	        return
	      } else if(token.data === '[') {
	        state.unshift(quantifier())
	        return
	      }
	    }
	    return state.shift()
	  }

	  function parse_keyword_or_ident() {
	    if(token.type === 'keyword') {
	      state[0].type = 'keyword'
	      state[0].mode = KEYWORD
	      return
	    }

	    if(token.type === 'ident') {
	      state[0].type = 'ident'
	      state[0].mode = IDENT
	      return
	    }

	    return unexpected('expected keyword or user-defined name, got '+token.data)
	  }

	  function parse_keyword() {
	    if(token.type !== 'keyword') {
	      return unexpected('expected keyword, got '+token.data)
	    }

	    return state.shift(), tokens.shift()
	  }

	  function parse_ident() {
	    if(token.type !== 'ident') {
	      return unexpected('expected user-defined name, got '+token.data)
	    }

	    state[0].data = token.data
	    return state.shift(), tokens.shift()
	  }


	  function parse_expr() {
	    var expecting = state[0].expecting

	    state[0].tokens = state[0].tokens || []

	    if(state[0].parenlevel === undefined) {
	      state[0].parenlevel = 0
	      state[0].bracelevel = 0
	    }
	    if(state[0].parenlevel < 1 && expecting.indexOf(token.data) > -1) {
	      return parseexpr(state[0].tokens)
	    }
	    if(token.data === '(') {
	      ++state[0].parenlevel
	    } else if(token.data === ')') {
	      --state[0].parenlevel
	    }

	    switch(token.data) {
	      case '{': ++state[0].bracelevel; break
	      case '}': --state[0].bracelevel; break
	      case '(': ++state[0].parenlevel; break
	      case ')': --state[0].parenlevel; break
	    }

	    if(state[0].parenlevel < 0) return unexpected('unexpected `)`')
	    if(state[0].bracelevel < 0) return unexpected('unexpected `}`')

	    state[0].tokens.push(tokens.shift())
	    return

	    function parseexpr(tokens) {
	      try {
	        full_parse_expr(state, tokens)
	      } catch(err) {
	        errored = true
	        throw err
	      }

	      return state.shift()
	    }
	  }

	  // node types ---------------

	  function n(type) {
	    // this is a function factory that suffices for most kinds of expressions and statements
	    return function() {
	      return mknode(type, token)
	    }
	  }

	  function adhoc() {
	    return mknode(token_map[token.type], token, node)
	  }

	  function decl(flags) {
	    var _ = mknode(DECL, token, node)
	    _.flags = flags

	    return _
	  }

	  function struct(allow_assign, allow_comma) {
	    var _ = mknode(STRUCT, token, node)
	    _.allow_assign = allow_assign === undefined ? true : allow_assign
	    _.allow_comma = allow_comma === undefined ? true : allow_comma
	    return _
	  }

	  function expr() {
	    var n = mknode(EXPR, token, node)

	    n.expecting = [].slice.call(arguments)
	    return n
	  }

	  function keyword(default_value) {
	    var t = token
	    if(default_value) {
	      t = {'type': '(implied)', data: '(default)', position: t.position}
	    }
	    return mknode(KEYWORD, t, node)
	  }

	  // utils ----------------------------

	  function unexpected(str) {
	    errored = true
	    throw new Error(
	      (str || 'unexpected '+state) +
	      ' at line '+state[0].token.line
	    )
	  }

	  function assert(type, data) {
	    return 1,
	      assert_null_string_or_array(type, token.type) &&
	      assert_null_string_or_array(data, token.data)
	  }

	  function assert_null_string_or_array(x, y) {
	    switch(typeof x) {
	      case 'string': if(y !== x) {
	        unexpected('expected `'+x+'`, got '+y+'\n'+token.data);
	      } return !errored

	      case 'object': if(x && x.indexOf(y) === -1) {
	        unexpected('expected one of `'+x.join('`, `')+'`, got '+y);
	      } return !errored
	    }
	    return true
	  }

	  // stative ----------------------------

	  function stative() {
	    var steps = [].slice.call(arguments)
	      , step
	      , result

	    return function() {
	      var current = state[0]

	      current.stage || (current.stage = 0)

	      step = steps[current.stage]
	      if(!step) return unexpected('parser in undefined state!')

	      result = step()

	      if(result === Advance) return ++current.stage
	      if(result === undefined) return
	      current.stage = result
	    }
	  }

	  function advance(op, t) {
	    t = t || 'operator'
	    return function() {
	      if(!assert(t, op)) return

	      var last = tokens.shift()
	        , children = state[0].children
	        , last_node = children[children.length - 1]

	      if(last_node && last_node.token && last.preceding) {
	        last_node.token.succeeding = last_node.token.succeeding || []
	        last_node.token.succeeding = last_node.token.succeeding.concat(last.preceding)
	      }
	      return Advance
	    }
	  }

	  function advance_expr(until) {
	    return function() {
	      state.unshift(expr(until))
	      return Advance
	    }
	  }

	  function advance_ident(declare) {
	    return declare ? function() {
	      var name = token.data
	      return assert('ident') && (state.unshift(ident()), state.scope.define(name), Advance)
	    } :  function() {
	      if(!assert('ident')) return

	      var s = Object.create(state.scope.find(token.data))
	      s.token = token

	      return (tokens.shift(), Advance)
	    }
	  }

	  function advance_stmtlist() {
	    return function() {
	      var n = stmtlist()
	      n.expecting = '}'
	      return state.unshift(n), Advance
	    }
	  }

	  function maybe_stmtlist(skip) {
	    return function() {
	      var current = state[0].stage
	      if(token.data !== '{') { return state.unshift(stmt()), current + skip }
	      return tokens.shift(), Advance
	    }
	  }

	  function popstmt() {
	    return function() { return state.shift(), state.shift() }
	  }


	  function setup_stative_parsers() {

	    // could also be
	    // struct { } decllist
	    parse_struct =
	        stative(
	          advance('struct', 'keyword')
	        , function() {
	            if(token.data === '{') {
	              state.fake(mknode(IDENT, {data:'', position: token.position, type:'ident'}))
	              return Advance
	            }

	            return advance_ident(true)()
	          }
	        , function() { state.scope.enter(); return Advance }
	        , advance('{')
	        , function() {
	            if(token.type === 'preprocessor') {
	              state.fake(adhoc())
	              tokens.shift()
	              return
	            }
	            if(token.data === '}') {
	              state.scope.exit()
	              tokens.shift()
	              return state.shift()
	            }
	            if(token.data === ';') { tokens.shift(); return }
	            state.unshift(decl(DECL_STRUCT))
	          }
	        )

	    parse_precision =
	        stative(
	          function() { return tokens.shift(), Advance }
	        , function() {
	            return assert(
	            'keyword', ['lowp', 'mediump', 'highp']
	            ) && (state.unshift(keyword()), Advance)
	          }
	        , function() { return (state.unshift(keyword()), Advance) }
	        , function() { return state.shift() }
	        )

	    parse_quantifier =
	        stative(
	          advance('[')
	        , advance_expr(']')
	        , advance(']')
	        , function() { return state.shift() }
	        )

	    parse_forloop =
	        stative(
	          advance('for', 'keyword')
	        , advance('(')
	        , function() {
	            var lookup
	            if(token.type === 'ident') {
	              if(!(lookup = state.scope.find(token.data))) {
	                lookup = state.create_node()
	              }

	              if(lookup.parent.type === 'struct') {
	                return state.unshift(decl(DECL_STATEMENT)), Advance
	              }
	            } else if(token.type === 'builtin' || token.type === 'keyword') {
	              return state.unshift(decl(DECL_STATEMENT)), Advance
	            }
	            return advance_expr(';')()
	          }
	        , advance(';')
	        , advance_expr(';')
	        , advance(';')
	        , advance_expr(')')
	        , advance(')')
	        , maybe_stmtlist(3)
	        , advance_stmtlist()
	        , advance('}')
	        , popstmt()
	        )

	    parse_if =
	        stative(
	          advance('if', 'keyword')
	        , advance('(')
	        , advance_expr(')')
	        , advance(')')
	        , maybe_stmtlist(3)
	        , advance_stmtlist()
	        , advance('}')
	        , function() {
	            if(token.data === 'else') {
	              return tokens.shift(), state.unshift(stmt()), Advance
	            }
	            return popstmt()()
	          }
	        , popstmt()
	        )

	    parse_return =
	        stative(
	          advance('return', 'keyword')
	        , function() {
	            if(token.data === ';') return Advance
	            return state.unshift(expr(';')), Advance
	          }
	        , function() { tokens.shift(), popstmt()() }
	        )

	    parse_whileloop =
	        stative(
	          advance('while', 'keyword')
	        , advance('(')
	        , advance_expr(')')
	        , advance(')')
	        , maybe_stmtlist(3)
	        , advance_stmtlist()
	        , advance('}')
	        , popstmt()
	        )

	    parse_dowhileloop =
	      stative(
	        advance('do', 'keyword')
	      , maybe_stmtlist(3)
	      , advance_stmtlist()
	      , advance('}')
	      , advance('while', 'keyword')
	      , advance('(')
	      , advance_expr(')')
	      , advance(')')
	      , popstmt()
	      )

	    parse_function =
	      stative(
	        function() {
	          for(var i = 1, len = state.length; i < len; ++i) if(state[i].mode === FUNCTION) {
	            return unexpected('function definition is not allowed within another function')
	          }

	          return Advance
	        }
	      , function() {
	          if(!assert("ident")) return

	          var name = token.data
	            , lookup = state.scope.find(name)

	          state.unshift(ident())
	          state.scope.define(name)

	          state.scope.enter(lookup ? lookup.scope : null)
	          return Advance
	        }
	      , advance('(')
	      , function() { return state.unshift(fnargs()), Advance }
	      , advance(')')
	      , function() {
	          // forward decl
	          if(token.data === ';') {
	            return state.scope.exit(), state.shift(), state.shift()
	          }
	          return Advance
	        }
	      , advance('{')
	      , advance_stmtlist()
	      , advance('}')
	      , function() { state.scope.exit(); return Advance }
	      , function() { return state.shift(), state.shift(), state.shift() }
	      )

	    parse_function_args =
	      stative(
	        function() {
	          if(token.data === 'void') { state.fake(keyword()); tokens.shift(); return Advance }
	          if(token.data === ')') { state.shift(); return }
	          if(token.data === 'struct') {
	            state.unshift(struct(NO_ASSIGN_ALLOWED, NO_COMMA_ALLOWED))
	            return Advance
	          }
	          state.unshift(decl(DECL_FUNCTION))
	          return Advance
	        }
	      , function() {
	          if(token.data === ',') { tokens.shift(); return 0 }
	          if(token.data === ')') { state.shift(); return }
	          unexpected('expected one of `,` or `)`, got '+token.data)
	        }
	      )
	  }
	}

	function mknode(mode, sourcetoken) {
	  return {
	      mode: mode
	    , token: sourcetoken
	    , children: []
	    , type: stmt_type[mode]
	    , id: (Math.random() * 0xFFFFFFFF).toString(16)
	  }
	}

	function is_storage(token) {
	  return token.data === 'const' ||
	         token.data === 'attribute' ||
	         token.data === 'uniform' ||
	         token.data === 'varying'
	}

	function is_parameter(token) {
	  return token.data === 'in' ||
	         token.data === 'inout' ||
	         token.data === 'out'
	}

	function is_precision(token) {
	  return token.data === 'highp' ||
	         token.data === 'mediump' ||
	         token.data === 'lowp'
	}


/***/ },
/* 13 */
/***/ function(module, exports) {

	var state
	  , token
	  , tokens
	  , idx

	var original_symbol = {
	    nud: function() { return this.children && this.children.length ? this : fail('unexpected')() }
	  , led: fail('missing operator')
	}

	var symbol_table = {}

	function itself() {
	  return this
	}

	symbol('(ident)').nud = itself
	symbol('(keyword)').nud = itself
	symbol('(builtin)').nud = itself
	symbol('(literal)').nud = itself
	symbol('(end)')

	symbol(':')
	symbol(';')
	symbol(',')
	symbol(')')
	symbol(']')
	symbol('}')

	infixr('&&', 30)
	infixr('||', 30)
	infix('|', 43)
	infix('^', 44)
	infix('&', 45)
	infix('==', 46)
	infix('!=', 46)
	infix('<', 47)
	infix('<=', 47)
	infix('>', 47)
	infix('>=', 47)
	infix('>>', 48)
	infix('<<', 48)
	infix('+', 50)
	infix('-', 50)
	infix('*', 60)
	infix('/', 60)
	infix('%', 60)
	infix('?', 20, function(left) {
	  this.children = [left, expression(0), (advance(':'), expression(0))]
	  this.type = 'ternary'
	  return this
	})
	infix('.', 80, function(left) {
	  token.type = 'literal'
	  state.fake(token)
	  this.children = [left, token]
	  advance()
	  return this
	})
	infix('[', 80, function(left) {
	  this.children = [left, expression(0)]
	  this.type = 'binary'
	  advance(']')
	  return this
	})
	infix('(', 80, function(left) {
	  this.children = [left]
	  this.type = 'call'

	  if(token.data !== ')') while(1) {
	    this.children.push(expression(0))
	    if(token.data !== ',') break
	    advance(',')
	  }
	  advance(')')
	  return this
	})

	prefix('-')
	prefix('+')
	prefix('!')
	prefix('~')
	prefix('defined')
	prefix('(', function() {
	  this.type = 'group'
	  this.children = [expression(0)]
	  advance(')')
	  return this 
	})
	prefix('++')
	prefix('--')
	suffix('++')
	suffix('--')

	assignment('=')
	assignment('+=')
	assignment('-=')
	assignment('*=')
	assignment('/=')
	assignment('%=')
	assignment('&=')
	assignment('|=')
	assignment('^=')
	assignment('>>=')
	assignment('<<=')

	module.exports = function(incoming_state, incoming_tokens) {
	  state = incoming_state
	  tokens = incoming_tokens
	  idx = 0
	  var result

	  if(!tokens.length) return

	  advance()
	  result = expression(0)
	  result.parent = state[0]
	  emit(result)

	  if(idx < tokens.length) {
	    throw new Error('did not use all tokens')
	  }

	  result.parent.children = [result]

	  function emit(node) {
	    state.unshift(node, false)
	    for(var i = 0, len = node.children.length; i < len; ++i) {
	      emit(node.children[i])
	    }
	    state.shift()
	  }

	}

	function symbol(id, binding_power) {
	  var sym = symbol_table[id]
	  binding_power = binding_power || 0
	  if(sym) {
	    if(binding_power > sym.lbp) {
	      sym.lbp = binding_power
	    }
	  } else {
	    sym = Object.create(original_symbol)
	    sym.id = id 
	    sym.lbp = binding_power
	    symbol_table[id] = sym
	  }
	  return sym
	}

	function expression(rbp) {
	  var left, t = token
	  advance()

	  left = t.nud()
	  while(rbp < token.lbp) {
	    t = token
	    advance()
	    left = t.led(left)
	  }
	  return left
	}

	function infix(id, bp, led) {
	  var sym = symbol(id, bp)
	  sym.led = led || function(left) {
	    this.children = [left, expression(bp)]
	    this.type = 'binary'
	    return this
	  }
	}

	function infixr(id, bp, led) {
	  var sym = symbol(id, bp)
	  sym.led = led || function(left) {
	    this.children = [left, expression(bp - 1)]
	    this.type = 'binary'
	    return this
	  }
	  return sym
	}

	function prefix(id, nud) {
	  var sym = symbol(id)
	  sym.nud = nud || function() {
	    this.children = [expression(70)]
	    this.type = 'unary'
	    return this
	  }
	  return sym
	}

	function suffix(id) {
	  var sym = symbol(id, 150)
	  sym.led = function(left) {
	    this.children = [left]
	    this.type = 'suffix'
	    return this
	  }
	}

	function assignment(id) {
	  return infixr(id, 10, function(left) {
	    this.children = [left, expression(9)]
	    this.assignment = true
	    this.type = 'assign'
	    return this
	  })
	}

	function advance(id) {
	  var next
	    , value
	    , type
	    , output

	  if(id && token.data !== id) {
	    return state.unexpected('expected `'+ id + '`, got `'+token.data+'`')
	  }

	  if(idx >= tokens.length) {
	    token = symbol_table['(end)']
	    return
	  }

	  next = tokens[idx++]
	  value = next.data
	  type = next.type

	  if(type === 'ident') {
	    output = state.scope.find(value) || state.create_node()
	    type = output.type
	  } else if(type === 'builtin') {
	    output = symbol_table['(builtin)']
	  } else if(type === 'keyword') {
	    output = symbol_table['(keyword)']
	  } else if(type === 'operator') {
	    output = symbol_table[value]
	    if(!output) {
	      return state.unexpected('unknown operator `'+value+'`')
	    }
	  } else if(type === 'float' || type === 'integer') {
	    type = 'literal'
	    output = symbol_table['(literal)']
	  } else {
	    return state.unexpected('unexpected token.')
	  }

	  if(output) {
	    if(!output.nud) { output.nud = itself }
	    if(!output.children) { output.children = [] }
	  }

	  output = Object.create(output)
	  output.token = next
	  output.type = type
	  if(!output.data) output.data = value

	  return token = output
	}

	function fail(message) {
	  return function() { return state.unexpected(message) }
	}


/***/ },
/* 14 */
/***/ function(module, exports) {

	module.exports = scope

	function scope(state) {
	  if(this.constructor !== scope)
	    return new scope(state)

	  this.state = state
	  this.scopes = []
	  this.current = null
	}

	var cons = scope
	  , proto = cons.prototype

	proto.enter = function(s) {
	  this.scopes.push(
	    this.current = this.state[0].scope = s || {}
	  )
	}

	proto.exit = function() {
	  this.scopes.pop()
	  this.current = this.scopes[this.scopes.length - 1]
	}

	proto.define = function(str) {
	  this.current[str] = this.state[0]
	}

	proto.find = function(name, fail) {
	  for(var i = this.scopes.length - 1; i > -1; --i) {
	    if(this.scopes[i].hasOwnProperty(name)) {
	      return this.scopes[i][name]
	    }
	  }

	  return null
	}


/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	var tokenize = __webpack_require__(16)

	module.exports = tokenizeString

	function tokenizeString(str, opt) {
	  var generator = tokenize(opt)
	  var tokens = []

	  tokens = tokens.concat(generator(str))
	  tokens = tokens.concat(generator(null))

	  return tokens
	}


/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = tokenize

	var literals100 = __webpack_require__(17)
	  , operators = __webpack_require__(18)
	  , builtins100 = __webpack_require__(19)
	  , literals300es = __webpack_require__(20)
	  , builtins300es = __webpack_require__(21)

	var NORMAL = 999          // <-- never emitted
	  , TOKEN = 9999          // <-- never emitted
	  , BLOCK_COMMENT = 0
	  , LINE_COMMENT = 1
	  , PREPROCESSOR = 2
	  , OPERATOR = 3
	  , INTEGER = 4
	  , FLOAT = 5
	  , IDENT = 6
	  , BUILTIN = 7
	  , KEYWORD = 8
	  , WHITESPACE = 9
	  , EOF = 10
	  , HEX = 11

	var map = [
	    'block-comment'
	  , 'line-comment'
	  , 'preprocessor'
	  , 'operator'
	  , 'integer'
	  , 'float'
	  , 'ident'
	  , 'builtin'
	  , 'keyword'
	  , 'whitespace'
	  , 'eof'
	  , 'integer'
	]

	function tokenize(opt) {
	  var i = 0
	    , total = 0
	    , mode = NORMAL
	    , c
	    , last
	    , content = []
	    , tokens = []
	    , token_idx = 0
	    , token_offs = 0
	    , line = 1
	    , col = 0
	    , start = 0
	    , isnum = false
	    , isoperator = false
	    , input = ''
	    , len

	  opt = opt || {}
	  var allBuiltins = builtins100
	  var allLiterals = literals100
	  if (opt.version === '300 es') {
	    allBuiltins = builtins300es
	    allLiterals = literals300es
	  }

	  return function(data) {
	    tokens = []
	    if (data !== null) return write(data.replace ? data.replace(/\r\n/g, '\n') : data)
	    return end()
	  }

	  function token(data) {
	    if (data.length) {
	      tokens.push({
	        type: map[mode]
	      , data: data
	      , position: start
	      , line: line
	      , column: col
	      })
	    }
	  }

	  function write(chunk) {
	    i = 0
	    input += chunk
	    len = input.length

	    var last

	    while(c = input[i], i < len) {
	      last = i

	      switch(mode) {
	        case BLOCK_COMMENT: i = block_comment(); break
	        case LINE_COMMENT: i = line_comment(); break
	        case PREPROCESSOR: i = preprocessor(); break
	        case OPERATOR: i = operator(); break
	        case INTEGER: i = integer(); break
	        case HEX: i = hex(); break
	        case FLOAT: i = decimal(); break
	        case TOKEN: i = readtoken(); break
	        case WHITESPACE: i = whitespace(); break
	        case NORMAL: i = normal(); break
	      }

	      if(last !== i) {
	        switch(input[last]) {
	          case '\n': col = 0; ++line; break
	          default: ++col; break
	        }
	      }
	    }

	    total += i
	    input = input.slice(i)
	    return tokens
	  }

	  function end(chunk) {
	    if(content.length) {
	      token(content.join(''))
	    }

	    mode = EOF
	    token('(eof)')
	    return tokens
	  }

	  function normal() {
	    content = content.length ? [] : content

	    if(last === '/' && c === '*') {
	      start = total + i - 1
	      mode = BLOCK_COMMENT
	      last = c
	      return i + 1
	    }

	    if(last === '/' && c === '/') {
	      start = total + i - 1
	      mode = LINE_COMMENT
	      last = c
	      return i + 1
	    }

	    if(c === '#') {
	      mode = PREPROCESSOR
	      start = total + i
	      return i
	    }

	    if(/\s/.test(c)) {
	      mode = WHITESPACE
	      start = total + i
	      return i
	    }

	    isnum = /\d/.test(c)
	    isoperator = /[^\w_]/.test(c)

	    start = total + i
	    mode = isnum ? INTEGER : isoperator ? OPERATOR : TOKEN
	    return i
	  }

	  function whitespace() {
	    if(/[^\s]/g.test(c)) {
	      token(content.join(''))
	      mode = NORMAL
	      return i
	    }
	    content.push(c)
	    last = c
	    return i + 1
	  }

	  function preprocessor() {
	    if((c === '\r' || c === '\n') && last !== '\\') {
	      token(content.join(''))
	      mode = NORMAL
	      return i
	    }
	    content.push(c)
	    last = c
	    return i + 1
	  }

	  function line_comment() {
	    return preprocessor()
	  }

	  function block_comment() {
	    if(c === '/' && last === '*') {
	      content.push(c)
	      token(content.join(''))
	      mode = NORMAL
	      return i + 1
	    }

	    content.push(c)
	    last = c
	    return i + 1
	  }

	  function operator() {
	    if(last === '.' && /\d/.test(c)) {
	      mode = FLOAT
	      return i
	    }

	    if(last === '/' && c === '*') {
	      mode = BLOCK_COMMENT
	      return i
	    }

	    if(last === '/' && c === '/') {
	      mode = LINE_COMMENT
	      return i
	    }

	    if(c === '.' && content.length) {
	      while(determine_operator(content));

	      mode = FLOAT
	      return i
	    }

	    if(c === ';' || c === ')' || c === '(') {
	      if(content.length) while(determine_operator(content));
	      token(c)
	      mode = NORMAL
	      return i + 1
	    }

	    var is_composite_operator = content.length === 2 && c !== '='
	    if(/[\w_\d\s]/.test(c) || is_composite_operator) {
	      while(determine_operator(content));
	      mode = NORMAL
	      return i
	    }

	    content.push(c)
	    last = c
	    return i + 1
	  }

	  function determine_operator(buf) {
	    var j = 0
	      , idx
	      , res

	    do {
	      idx = operators.indexOf(buf.slice(0, buf.length + j).join(''))
	      res = operators[idx]

	      if(idx === -1) {
	        if(j-- + buf.length > 0) continue
	        res = buf.slice(0, 1).join('')
	      }

	      token(res)

	      start += res.length
	      content = content.slice(res.length)
	      return content.length
	    } while(1)
	  }

	  function hex() {
	    if(/[^a-fA-F0-9]/.test(c)) {
	      token(content.join(''))
	      mode = NORMAL
	      return i
	    }

	    content.push(c)
	    last = c
	    return i + 1
	  }

	  function integer() {
	    if(c === '.') {
	      content.push(c)
	      mode = FLOAT
	      last = c
	      return i + 1
	    }

	    if(/[eE]/.test(c)) {
	      content.push(c)
	      mode = FLOAT
	      last = c
	      return i + 1
	    }

	    if(c === 'x' && content.length === 1 && content[0] === '0') {
	      mode = HEX
	      content.push(c)
	      last = c
	      return i + 1
	    }

	    if(/[^\d]/.test(c)) {
	      token(content.join(''))
	      mode = NORMAL
	      return i
	    }

	    content.push(c)
	    last = c
	    return i + 1
	  }

	  function decimal() {
	    if(c === 'f') {
	      content.push(c)
	      last = c
	      i += 1
	    }

	    if(/[eE]/.test(c)) {
	      content.push(c)
	      last = c
	      return i + 1
	    }

	    if (c === '-' && /[eE]/.test(last)) {
	      content.push(c)
	      last = c
	      return i + 1
	    }

	    if(/[^\d]/.test(c)) {
	      token(content.join(''))
	      mode = NORMAL
	      return i
	    }

	    content.push(c)
	    last = c
	    return i + 1
	  }

	  function readtoken() {
	    if(/[^\d\w_]/.test(c)) {
	      var contentstr = content.join('')
	      if(allLiterals.indexOf(contentstr) > -1) {
	        mode = KEYWORD
	      } else if(allBuiltins.indexOf(contentstr) > -1) {
	        mode = BUILTIN
	      } else {
	        mode = IDENT
	      }
	      token(content.join(''))
	      mode = NORMAL
	      return i
	    }
	    content.push(c)
	    last = c
	    return i + 1
	  }
	}


/***/ },
/* 17 */
/***/ function(module, exports) {

	module.exports = [
	  // current
	    'precision'
	  , 'highp'
	  , 'mediump'
	  , 'lowp'
	  , 'attribute'
	  , 'const'
	  , 'uniform'
	  , 'varying'
	  , 'break'
	  , 'continue'
	  , 'do'
	  , 'for'
	  , 'while'
	  , 'if'
	  , 'else'
	  , 'in'
	  , 'out'
	  , 'inout'
	  , 'float'
	  , 'int'
	  , 'void'
	  , 'bool'
	  , 'true'
	  , 'false'
	  , 'discard'
	  , 'return'
	  , 'mat2'
	  , 'mat3'
	  , 'mat4'
	  , 'vec2'
	  , 'vec3'
	  , 'vec4'
	  , 'ivec2'
	  , 'ivec3'
	  , 'ivec4'
	  , 'bvec2'
	  , 'bvec3'
	  , 'bvec4'
	  , 'sampler1D'
	  , 'sampler2D'
	  , 'sampler3D'
	  , 'samplerCube'
	  , 'sampler1DShadow'
	  , 'sampler2DShadow'
	  , 'struct'

	  // future
	  , 'asm'
	  , 'class'
	  , 'union'
	  , 'enum'
	  , 'typedef'
	  , 'template'
	  , 'this'
	  , 'packed'
	  , 'goto'
	  , 'switch'
	  , 'default'
	  , 'inline'
	  , 'noinline'
	  , 'volatile'
	  , 'public'
	  , 'static'
	  , 'extern'
	  , 'external'
	  , 'interface'
	  , 'long'
	  , 'short'
	  , 'double'
	  , 'half'
	  , 'fixed'
	  , 'unsigned'
	  , 'input'
	  , 'output'
	  , 'hvec2'
	  , 'hvec3'
	  , 'hvec4'
	  , 'dvec2'
	  , 'dvec3'
	  , 'dvec4'
	  , 'fvec2'
	  , 'fvec3'
	  , 'fvec4'
	  , 'sampler2DRect'
	  , 'sampler3DRect'
	  , 'sampler2DRectShadow'
	  , 'sizeof'
	  , 'cast'
	  , 'namespace'
	  , 'using'
	]


/***/ },
/* 18 */
/***/ function(module, exports) {

	module.exports = [
	    '<<='
	  , '>>='
	  , '++'
	  , '--'
	  , '<<'
	  , '>>'
	  , '<='
	  , '>='
	  , '=='
	  , '!='
	  , '&&'
	  , '||'
	  , '+='
	  , '-='
	  , '*='
	  , '/='
	  , '%='
	  , '&='
	  , '^^'
	  , '^='
	  , '|='
	  , '('
	  , ')'
	  , '['
	  , ']'
	  , '.'
	  , '!'
	  , '~'
	  , '*'
	  , '/'
	  , '%'
	  , '+'
	  , '-'
	  , '<'
	  , '>'
	  , '&'
	  , '^'
	  , '|'
	  , '?'
	  , ':'
	  , '='
	  , ','
	  , ';'
	  , '{'
	  , '}'
	]


/***/ },
/* 19 */
/***/ function(module, exports) {

	module.exports = [
	  // Keep this list sorted
	  'abs'
	  , 'acos'
	  , 'all'
	  , 'any'
	  , 'asin'
	  , 'atan'
	  , 'ceil'
	  , 'clamp'
	  , 'cos'
	  , 'cross'
	  , 'dFdx'
	  , 'dFdy'
	  , 'degrees'
	  , 'distance'
	  , 'dot'
	  , 'equal'
	  , 'exp'
	  , 'exp2'
	  , 'faceforward'
	  , 'floor'
	  , 'fract'
	  , 'gl_BackColor'
	  , 'gl_BackLightModelProduct'
	  , 'gl_BackLightProduct'
	  , 'gl_BackMaterial'
	  , 'gl_BackSecondaryColor'
	  , 'gl_ClipPlane'
	  , 'gl_ClipVertex'
	  , 'gl_Color'
	  , 'gl_DepthRange'
	  , 'gl_DepthRangeParameters'
	  , 'gl_EyePlaneQ'
	  , 'gl_EyePlaneR'
	  , 'gl_EyePlaneS'
	  , 'gl_EyePlaneT'
	  , 'gl_Fog'
	  , 'gl_FogCoord'
	  , 'gl_FogFragCoord'
	  , 'gl_FogParameters'
	  , 'gl_FragColor'
	  , 'gl_FragCoord'
	  , 'gl_FragData'
	  , 'gl_FragDepth'
	  , 'gl_FragDepthEXT'
	  , 'gl_FrontColor'
	  , 'gl_FrontFacing'
	  , 'gl_FrontLightModelProduct'
	  , 'gl_FrontLightProduct'
	  , 'gl_FrontMaterial'
	  , 'gl_FrontSecondaryColor'
	  , 'gl_LightModel'
	  , 'gl_LightModelParameters'
	  , 'gl_LightModelProducts'
	  , 'gl_LightProducts'
	  , 'gl_LightSource'
	  , 'gl_LightSourceParameters'
	  , 'gl_MaterialParameters'
	  , 'gl_MaxClipPlanes'
	  , 'gl_MaxCombinedTextureImageUnits'
	  , 'gl_MaxDrawBuffers'
	  , 'gl_MaxFragmentUniformComponents'
	  , 'gl_MaxLights'
	  , 'gl_MaxTextureCoords'
	  , 'gl_MaxTextureImageUnits'
	  , 'gl_MaxTextureUnits'
	  , 'gl_MaxVaryingFloats'
	  , 'gl_MaxVertexAttribs'
	  , 'gl_MaxVertexTextureImageUnits'
	  , 'gl_MaxVertexUniformComponents'
	  , 'gl_ModelViewMatrix'
	  , 'gl_ModelViewMatrixInverse'
	  , 'gl_ModelViewMatrixInverseTranspose'
	  , 'gl_ModelViewMatrixTranspose'
	  , 'gl_ModelViewProjectionMatrix'
	  , 'gl_ModelViewProjectionMatrixInverse'
	  , 'gl_ModelViewProjectionMatrixInverseTranspose'
	  , 'gl_ModelViewProjectionMatrixTranspose'
	  , 'gl_MultiTexCoord0'
	  , 'gl_MultiTexCoord1'
	  , 'gl_MultiTexCoord2'
	  , 'gl_MultiTexCoord3'
	  , 'gl_MultiTexCoord4'
	  , 'gl_MultiTexCoord5'
	  , 'gl_MultiTexCoord6'
	  , 'gl_MultiTexCoord7'
	  , 'gl_Normal'
	  , 'gl_NormalMatrix'
	  , 'gl_NormalScale'
	  , 'gl_ObjectPlaneQ'
	  , 'gl_ObjectPlaneR'
	  , 'gl_ObjectPlaneS'
	  , 'gl_ObjectPlaneT'
	  , 'gl_Point'
	  , 'gl_PointCoord'
	  , 'gl_PointParameters'
	  , 'gl_PointSize'
	  , 'gl_Position'
	  , 'gl_ProjectionMatrix'
	  , 'gl_ProjectionMatrixInverse'
	  , 'gl_ProjectionMatrixInverseTranspose'
	  , 'gl_ProjectionMatrixTranspose'
	  , 'gl_SecondaryColor'
	  , 'gl_TexCoord'
	  , 'gl_TextureEnvColor'
	  , 'gl_TextureMatrix'
	  , 'gl_TextureMatrixInverse'
	  , 'gl_TextureMatrixInverseTranspose'
	  , 'gl_TextureMatrixTranspose'
	  , 'gl_Vertex'
	  , 'greaterThan'
	  , 'greaterThanEqual'
	  , 'inversesqrt'
	  , 'length'
	  , 'lessThan'
	  , 'lessThanEqual'
	  , 'log'
	  , 'log2'
	  , 'matrixCompMult'
	  , 'max'
	  , 'min'
	  , 'mix'
	  , 'mod'
	  , 'normalize'
	  , 'not'
	  , 'notEqual'
	  , 'pow'
	  , 'radians'
	  , 'reflect'
	  , 'refract'
	  , 'sign'
	  , 'sin'
	  , 'smoothstep'
	  , 'sqrt'
	  , 'step'
	  , 'tan'
	  , 'texture2D'
	  , 'texture2DLod'
	  , 'texture2DProj'
	  , 'texture2DProjLod'
	  , 'textureCube'
	  , 'textureCubeLod'
	  , 'texture2DLodEXT'
	  , 'texture2DProjLodEXT'
	  , 'textureCubeLodEXT'
	  , 'texture2DGradEXT'
	  , 'texture2DProjGradEXT'
	  , 'textureCubeGradEXT'
	]


/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	var v100 = __webpack_require__(17)

	module.exports = v100.slice().concat([
	   'layout'
	  , 'centroid'
	  , 'smooth'
	  , 'case'
	  , 'mat2x2'
	  , 'mat2x3'
	  , 'mat2x4'
	  , 'mat3x2'
	  , 'mat3x3'
	  , 'mat3x4'
	  , 'mat4x2'
	  , 'mat4x3'
	  , 'mat4x4'
	  , 'uint'
	  , 'uvec2'
	  , 'uvec3'
	  , 'uvec4'
	  , 'samplerCubeShadow'
	  , 'sampler2DArray'
	  , 'sampler2DArrayShadow'
	  , 'isampler2D'
	  , 'isampler3D'
	  , 'isamplerCube'
	  , 'isampler2DArray'
	  , 'usampler2D'
	  , 'usampler3D'
	  , 'usamplerCube'
	  , 'usampler2DArray'
	  , 'coherent'
	  , 'restrict'
	  , 'readonly'
	  , 'writeonly'
	  , 'resource'
	  , 'atomic_uint'
	  , 'noperspective'
	  , 'patch'
	  , 'sample'
	  , 'subroutine'
	  , 'common'
	  , 'partition'
	  , 'active'
	  , 'filter'
	  , 'image1D'
	  , 'image2D'
	  , 'image3D'
	  , 'imageCube'
	  , 'iimage1D'
	  , 'iimage2D'
	  , 'iimage3D'
	  , 'iimageCube'
	  , 'uimage1D'
	  , 'uimage2D'
	  , 'uimage3D'
	  , 'uimageCube'
	  , 'image1DArray'
	  , 'image2DArray'
	  , 'iimage1DArray'
	  , 'iimage2DArray'
	  , 'uimage1DArray'
	  , 'uimage2DArray'
	  , 'image1DShadow'
	  , 'image2DShadow'
	  , 'image1DArrayShadow'
	  , 'image2DArrayShadow'
	  , 'imageBuffer'
	  , 'iimageBuffer'
	  , 'uimageBuffer'
	  , 'sampler1DArray'
	  , 'sampler1DArrayShadow'
	  , 'isampler1D'
	  , 'isampler1DArray'
	  , 'usampler1D'
	  , 'usampler1DArray'
	  , 'isampler2DRect'
	  , 'usampler2DRect'
	  , 'samplerBuffer'
	  , 'isamplerBuffer'
	  , 'usamplerBuffer'
	  , 'sampler2DMS'
	  , 'isampler2DMS'
	  , 'usampler2DMS'
	  , 'sampler2DMSArray'
	  , 'isampler2DMSArray'
	  , 'usampler2DMSArray'
	])


/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	// 300es builtins/reserved words that were previously valid in v100
	var v100 = __webpack_require__(19)

	// The texture2D|Cube functions have been removed
	// And the gl_ features are updated
	v100 = v100.slice().filter(function (b) {
	  return !/^(gl\_|texture)/.test(b)
	})

	module.exports = v100.concat([
	  // the updated gl_ constants
	    'gl_VertexID'
	  , 'gl_InstanceID'
	  , 'gl_Position'
	  , 'gl_PointSize'
	  , 'gl_FragCoord'
	  , 'gl_FrontFacing'
	  , 'gl_FragDepth'
	  , 'gl_PointCoord'
	  , 'gl_MaxVertexAttribs'
	  , 'gl_MaxVertexUniformVectors'
	  , 'gl_MaxVertexOutputVectors'
	  , 'gl_MaxFragmentInputVectors'
	  , 'gl_MaxVertexTextureImageUnits'
	  , 'gl_MaxCombinedTextureImageUnits'
	  , 'gl_MaxTextureImageUnits'
	  , 'gl_MaxFragmentUniformVectors'
	  , 'gl_MaxDrawBuffers'
	  , 'gl_MinProgramTexelOffset'
	  , 'gl_MaxProgramTexelOffset'
	  , 'gl_DepthRangeParameters'
	  , 'gl_DepthRange'

	  // other builtins
	  , 'trunc'
	  , 'round'
	  , 'roundEven'
	  , 'isnan'
	  , 'isinf'
	  , 'floatBitsToInt'
	  , 'floatBitsToUint'
	  , 'intBitsToFloat'
	  , 'uintBitsToFloat'
	  , 'packSnorm2x16'
	  , 'unpackSnorm2x16'
	  , 'packUnorm2x16'
	  , 'unpackUnorm2x16'
	  , 'packHalf2x16'
	  , 'unpackHalf2x16'
	  , 'outerProduct'
	  , 'transpose'
	  , 'determinant'
	  , 'inverse'
	  , 'texture'
	  , 'textureSize'
	  , 'textureProj'
	  , 'textureLod'
	  , 'textureOffset'
	  , 'texelFetch'
	  , 'texelFetchOffset'
	  , 'textureProjOffset'
	  , 'textureLodOffset'
	  , 'textureProjLod'
	  , 'textureProjLodOffset'
	  , 'textureGrad'
	  , 'textureGradOffset'
	  , 'textureProjGrad'
	  , 'textureProjGradOffset'
	])


/***/ },
/* 22 */
/***/ function(module, exports) {

	module.exports = extend

	var hasOwnProperty = Object.prototype.hasOwnProperty;

	function extend(target) {
	    for (var i = 1; i < arguments.length; i++) {
	        var source = arguments[i]

	        for (var key in source) {
	            if (hasOwnProperty.call(source, key)) {
	                target[key] = source[key]
	            }
	        }
	    }

	    return target
	}


/***/ },
/* 23 */
/***/ function(module, exports) {

	/**
	 * A collection of builtins with types
	 */

	exports.gl_NumWorkGroups = 'uvec3';
	exports.gl_WorkGroupSize = 'uvec3';
	exports.gl_WorkGroupID = 'uvec3';
	exports.gl_LocalInvocationID = 'uvec3';
	exports.gl_GlobalInvocationID = 'uvec3';
	exports.gl_LocalInvocationIndex = 'uint';
	exports.gl_VertexID = 'int';
	exports.gl_InstanceID = 'int';
	exports.gl_Position = 'vec4';
	exports.gl_PointSize = 'float';
	exports.gl_ClipDistance = 'float';
	exports.gl_FragCoord = 'vec4';
	exports.gl_FragColor = 'vec4';
	exports.gl_FrontFacing = 'bool';
	exports.gl_PointCoord = 'vec2';
	exports.gl_PrimitiveID = 'int';
	exports.gl_SampleID = 'int';
	exports.gl_SamplePosition = 'vec2';
	exports.gl_SampleMaskIn = 'int';
	exports.gl_Layer = 'int';
	exports.gl_ViewportIndex = 'int';
	exports.gl_FragDepth = 'float';
	exports.gl_SampleMask = 'int';

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Type constructors.
	 *
	 * If type is detected in the code, like `float[2](1, 2, 3)` or `vec3(vec2(), 1)`,
	 * the according function will be called and type is stringified as return.
	 *
	 * The arguments are nodes, so that we can detect the type of the args
	 * to do like mat2(vec2, vec2) etc.
	 *
	 * Also types save components access, in optimisation purposes.
	 * So after you can call `getComponent(node, idx)` for getting shorten stringified version of a node’s component.
	 *
	 * OpenGL types @ref https://www.opengl.org/registry/doc/GLSLangSpec.4.40.pdf
	 *
	 * @module  glsl-js/lib/types
	 */


	var Descriptor = __webpack_require__(25);


	var floatRE = /^-?[0-9]*(?:.[0-9]+)?(?:e-?[0-9]+)?$/i;

	exports.void = function () {
		return '';
	}


	function bool (node) {
		if (node == null) return Descriptor(false, {type: 'bool', complexity: 0});

		var result;

		//node passed
		if (node instanceof String) {
			result = node.components[0];
		}
		else if (typeof node === 'object') {
			result = this.process(node).components[0];
		}
		//string/value passed
		else {
			result = node;
		}

		//bool?
		if (result == 'true' || result === true) return Descriptor(true, {type: 'bool', complexity: 0});
		if (result == 'false' || result === false) return Descriptor(false, {type: 'bool', complexity: 0});

		//number/string?
		var num = floatRE.exec(result);

		//it was string - preserve complex argument
		if (num == null) {
			return Descriptor('!!' + result, {type: 'bool', complexity: result.complexity + 1});
		}

		//cast number to bool
		return Descriptor(!!parseFloat(num), {type: 'bool', complexity: 0});
	}
	bool.type = 'bool';

	exports.bool = bool;


	function int (node) {
		if (node == null) return Descriptor(0, {type: 'int', complexity: 0});

		if (typeof node !== 'object') return Descriptor(+node|0, {type: 'int', complexity: 0});

		var result;

		//node?
		if (node instanceof String) {
			result = node.components[0];
		}
		else if (typeof node === 'object') {
			result = this.process(node).components[0];
		}
		//number/string/descriptor?
		else {
			result = node;
		}

		//bool?
		if (result == 'true' || result === true) return Descriptor(1, {type: 'int', complexity: 0});
		if (result == 'false' || result === false) return Descriptor(0, {type: 'int', complexity: 0});

		var num = floatRE.exec(result);

		//it was number
		if (num != null) {
			return Descriptor(+parseFloat(num)|0, {type: 'int', complexity: 0});
		}

		//it was string
		return Descriptor(result + '|0', {type: 'int', complexity: result.complexity});
	}
	int.type = 'int';

	exports.int =
	exports.uint =
	exports.byte =
	exports.short = int;


	function float (node) {
		if (node == null) return Descriptor(0, {type: 'float', complexity: 0});

		var result;

		if (node instanceof String) {
			result = node.components[0];
		}
		else if (typeof node === 'object') {
			result = this.process(node).components[0];
		}
		else {
			result = node;
		}

		//bool?
		if (result == 'true' || result === true) return Descriptor(1.0, {type: 'float', complexity: 0});
		if (result == 'false' || result === false) return Descriptor(0.0, {type: 'float', complexity: 0});

		var num = floatRE.exec(result);

		//it was number
		if (num != null) {
			return Descriptor(+parseFloat(num), {type: 'float', complexity: 0});
		}
		//it was string
		else {
			if (result.type === 'int' || result.type === 'float') {
				return Descriptor(result, {type: 'float', complexity: result.complexity});
			} else {
				return Descriptor('+' + result, {type: 'float', complexity: result.complexity + 1});
			}
		}
	}
	float.type = 'float';

	exports.float =
	exports.double = float;

	function createVec2 (type, vecType) {
		vec2.type = type;
		function vec2 (x, y) {
			//vec2(*) → vec2(*, *)
			if (x == null) x = 0;
			if (y == null) y = x;

			var x = this.process(x);
			var y = this.process(y);

			var components = [], map = ``, include;

			//map type, if input args are of diff type (unlikely required)
			if (!subType(x.components[0].type, type) || !subType(y.components[0].type, type)) {
				map = `.map(${type})`;
				include = type;
			}

			//vec2(vec2) → vec2
			if (this.types[x.type].length === 2) {
				return x;
			}

			//vec2(vec3) → vec3.slice(0, 2)
			if (this.types[x.type].length > 2) {
				return Descriptor(`${x}.slice(0, 2)${map}`, {
					components: x.components.slice(0, 2).map(this.types[type], this),
					type: vecType,
					complexity: x.complexity + 2,
					include: include
				});
			};

			//vec2(float) → [0, 0].fill(float)
			if (x === y) {
				return Descriptor(`[0, 0].fill(${x})${map}`, {
					complexity: x.complexity + 2,
					components: [x, y].map(this.types[type], this),
					type: vecType,
					include: include
				});
			}

			//vec2(simple, simple) → [simple, simple]
			return Descriptor(`[${[x,y].join(', ')}]${map}`, {
				components: [x, y].map(this.types[type], this),
				type: vecType,
				complexity: x.complexity + y.complexity,
				include: include
			});
		}
		return vec2;
	};

	function createVec3 (type, vecType) {
		vec3.type = type;
		function vec3 (x, y, z) {
			//vec3(*) → vec3(*, *, *)
			if (x == null) x = 0;
			if (y == null) y = x;
			if (z == null) z = y;

			x = this.process(x);
			y = this.process(y);
			z = this.process(z);

			var components = [], map = ``, include;

			//map type, if input args are of diff type (unlikely required)
			if (!subType(x.components[0].type, type)  || !subType(y.components[0].type, type)  || !subType(z.components[0].type, type) ) {
				map = `.map(${type})`;
				include = type;
			}

			//vec3(vec3) → vec3
			if (this.types[x.type].length === 3) {
				return x;
			}

			//vec3(vecN) → vecN.slice(0, 3)
			if (this.types[x.type].length > 3) {
				return Descriptor(`${x}.slice(0, 3)${map}`, {
					components: x.components.slice(0, 3).map(this.types[type], this),
					type: vecType,
					complexity: x.complexity + 3 + 3,
					include: include
				});
			}

			//vec3(vec2, *) → vec2.concat(*)
			if (this.types[x.type].length === 2) {
				return Descriptor(`${x}.concat(${this.types.float.call(this, y)})${map}`, {
					components: x.components.concat(y.components[0]).map(this.types[type], this),
					type: vecType,
					complexity: x.complexity + y.complexity + 3,
					include: include
				});
			}

			//vec3(float, vecN) → [float].concat(vecN.slice(0,2));
			if (this.types[y.type].length > 1) {
				return Descriptor(`[${x}].concat(${this.types.vec2.call(this, y, z)})${map}`, {
					components: [x].concat(y.components.slice(0, 2)).map(this.types[type], this),
					type: vecType,
					complexity: x.complexity + y.complexity + z.complexity + 3,
					include: include
				});
			}

			return Descriptor(`[${[x,y,z].join(', ')}]${map}`, {
				components: [x, y, z].map(this.types[type], this),
				type: vecType,
				complexity: x.complexity + y.complexity + z.complexity + 3,
				include: include
			});
		}
		return vec3;
	};

	function createVec4 (type, vecType) {
		vec4.type = type;
		function vec4 (x, y, z, w) {
			if (x == null) x = 0;
			if (y == null) y = x;
			if (z == null) z = y;
			if (w == null) w = z;

			var x = this.process(x);
			var y = this.process(y);
			var z = this.process(z);
			var w = this.process(w);

			var components = [], map = ``, include;

			//map type, if input args are of diff type (unlikely required)
			if (!subType(x.components[0].type, type)  || !subType(y.components[0].type, type)  || !subType(z.components[0].type, type)  || !subType(w.components[0].type, type) ) {
				map = `.map(${type})`;
				include = type;
			}

			//vec4(matN)
			if (/mat/.test(x.type)) {
				return Descriptor(x, {
					components: x.components.map(this.types[type], this),
					type: vecType,
					include: include
				});
			}

			//vec4(vecN) → vecN.slice(0, 4)
			if (this.types[x.type].length > 4) {
				return Descriptor(`${x}.slice(0, 4)${map}`, {
					components: x.components.slice(0, 4).map(this.types[type], this),
					type: vecType,
					include: include
				});
			}

			//vec4(vec4) → vec4
			if (this.types[x.type].length === 4) {
				return x;
			}

			//vec4(vec3, *) → vec3.concat(*)
			if (this.types[x.type].length === 3) {
				return Descriptor(`${x}.concat(${this.types.float.call(this, y)})${map}`, {
					components: x.components.concat(y.components[0]).map(this.types[type], this),
					type: vecType,
					include: include
				});
			}

			//vec4(vec2, *) → vec2.concat(*)
			if (this.types[x.type].length === 2) {
				//vec4(vec2, vecN)
				if (this.types[y.type].length > 1) {
					return Descriptor(`${x}.concat(${this.types.vec2.call(this, y)})${map}`, {
						components: x.components.concat(y.components.slice(0, 2)).map(this.types[type], this),
						type: vecType,
						include: include
					});
				}

				//vec4(vec2, float, float)
				var res = Descriptor(
					`${x}.concat(${this.types.vec2.call(this, y, z)})${map}`, {
						components: x.components.concat(y.components[0], z.components[0]).map(this.types[type], this),
						type: vecType,
						include: include
					});
				return res;
			}

			//vec4(float, vec2, *)
			if (this.types[y.type].length === 2) {
				return Descriptor(`[${x}].concat(${this.types.vec2.call(this, y)}, ${this.types.float.call(this, z)})${map}`, {
					components: x.components.concat(y.components, z.components[0]).map(this.types[type], this),
					type: vecType,
					include: include
				});
			}

			//vec4(float, vecN)
			if (this.types[y.type].length > 2) {
				return Descriptor(`[${x}].concat(${this.types.vec3.call(this, y, z, w)})${map}`, {
					components: x.components.concat(y.components.slice(0, 3)).map(this.types[type], this),
					type: vecType,
					include: include
				});
			}

			//vec4(float, float, vecN)
			if (this.types[z.type].length > 1) {
				return Descriptor(`[${x}].concat(${y}, ${this.types.vec2.call(this, z)})${map}`, {
					components: x.components.concat(y.components[0], z.components.slice(0, 2)).map(this.types[type], this),
					type: vecType,
					include: include
				});
			}

			return Descriptor(`[${[x,y,z,w].join(', ')}]${map}`, {
				components: [x, y, z, w].map(this.types[type], this),
				type: vecType,
				include: include
			});
		}
		return vec4;
	}

	exports.ivec2 = createVec2('int', 'ivec2');
	exports.uvec2 = createVec2('uint', 'uvec2');
	exports.bvec2 = createVec2('bool', 'bvec2');
	exports.dvec2 = createVec2('double', 'dvec2');
	exports.vec2 = createVec2('float', 'vec2');

	exports.ivec3 = createVec3('int', 'ivec3');
	exports.uvec3 = createVec3('uint', 'uvec3');
	exports.bvec3 = createVec3('bool', 'bvec3');
	exports.dvec3 = createVec3('double', 'dvec3');
	exports.vec3 = createVec3('float', 'vec3');

	exports.ivec4 = createVec4('int', 'ivec4');
	exports.uvec4 = createVec4('uint', 'uvec4');
	exports.bvec4 = createVec4('bool', 'bvec4');
	exports.dvec4 = createVec4('double', 'dvec4');
	exports.vec4 = createVec4('float', 'vec4');


	/**
	 * Matrices are arrays of arrays (vectors)
	 */
	function mat2 (v0, v1) {
		//mat2(x0, y0, x1, y1)
		if (arguments.length >= 4) {
			var x0 = this.process(arguments[0]);
			var y0 = this.process(arguments[1]);
			var x1 = this.process(arguments[2]);
			var y1 = this.process(arguments[3]);
			var comps = [x0, y0, x1, y1];
			return Descriptor(
				`[${comps.join(', ')}]`, {
				components: comps,
				type: 'mat2',
				complexity: cmpl(comps)
			});
		};

		//ensure at least identity matrix
		if (v0 == null) v0 = 1;

		var v0 = this.process(v0);
		var v1 = this.process(v1);

		//mat2(float) → identity matrix
		if (this.types[v0.type].length === 1) {
			var res = Descriptor(
				`mat2(${v0})`, {
				components: [
					v0, 0,
					0, v0
				].map(float, this),
				type: 'mat2',
				complexity: v0.complexity * 2 + 2,
				include: 'mat2'
			});
			return res;
		}

		//mat2(mat2)
		if (v0.type === 'mat2') {
			return v0;
		}

		//mat(vec, vec)
		var comps = v0.components.slice(0,2).concat(v1.components.slice(0,2));
		return Descriptor(`${this.types.vec2.call(this, v0)}.concat(${this.types.vec2.call(this, v1)})`, {
			components: comps.map(float, this),
			complexity: cmpl(comps),
			type: 'mat2'
		});
	}
	mat2.type = 'vec2';

	function mat3 (v0, v1, v2) {
		//mat2(x0, y0, z0, x1, y1, z1, x2, y2, z2)
		if (arguments.length >= 9) {
			var x0 = this.process(arguments[0]);
			var y0 = this.process(arguments[1]);
			var z0 = this.process(arguments[2]);
			var x1 = this.process(arguments[3]);
			var y1 = this.process(arguments[4]);
			var z1 = this.process(arguments[5]);
			var x2 = this.process(arguments[6]);
			var y2 = this.process(arguments[7]);
			var z2 = this.process(arguments[8]);
			var comps = [x0, y0, z0, x1, y1, z1, x2, y2, z2];
			return Descriptor(
				`[${comps.join(', ')}]`, {
				components: comps,
				type: 'mat3',
				complexity: cmpl(comps)
			});
		};

		//ensure at least identity matrix
		if (v0 == null) v0 = 1;

		var v0 = this.process(v0);
		var v1 = this.process(v1);
		var v2 = this.process(v2);

		//mat3(float) → identity matrix
		if (this.types[v0.type].length === 1) {
			var res = Descriptor(
				`mat3(${v0})`, {
				components: [
					v0, 0, 0,
					0, v0, 0,
					0, 0, v0
				].map(float, this),
				type: 'mat3',
				include: 'mat3',
				complexity: v0.complexity * 3 + 6
			});
			return res;
		}

		//mat3(mat2)
		if (v0.type === 'mat2') {
			return Descriptor(`[0,1,null, 2,3,null, null,null,-1].map(function (i) {return i == null ? 0 : i < 0 ? -i : this[i]}, ${v0})`, {
				components: [
					v0.components[0], v0.components[1], 0,
					v0.components[2], v0.components[3], 0,
					0, 0, 1
				].map(float, this),
				type: 'mat3',
				complexity: 9 * 3 + v0.complexity
			});
		}

		//mat3(mat3)
		if (v0.type === 'mat3') {
			return v0;
		}

		//mat3(mat4)
		if (v0.type === 'mat4') {
			var components = v0.components;
			return Descriptor(`${v0}.filter(function (x, i) { return i % 4 !== 3 && i < 12; })`, {
				components: components.slice(0, 3).concat(components.slice(4, 7), components.slice(8, 11)).map(float, this),
				type: 'mat3',
				complexity: 16 * 3 + v0.complexity
			});
		}

		//mat(vec, vec, vec)
		var comps = v0.components.slice(0,3).concat(v1.components.slice(0,3), v2.components.slice(0,3));
		var res = Descriptor(`${this.types.vec3.call(this, v0)}.concat(${this.types.vec3.call(this, v1)}, ${this.types.vec3.call(this, v2)})`, {
			components: comps.map(float, this),
			type: 'mat3',
			complexity: cmpl(comps)
		});
		return res;
	}
	mat3.type = 'vec3';

	function mat4 (v0, v1, v2, v3) {
		//mat2(x0, y0, z0, w0, x1, y1, z1, w1, x2, y2, z2, w2, x3, y3, z3, w3)
		if (arguments.length >= 16) {
			var x0 = this.process(arguments[0]);
			var y0 = this.process(arguments[1]);
			var z0 = this.process(arguments[2]);
			var w0 = this.process(arguments[3]);
			var x1 = this.process(arguments[4]);
			var y1 = this.process(arguments[5]);
			var z1 = this.process(arguments[6]);
			var w1 = this.process(arguments[7]);
			var x2 = this.process(arguments[8]);
			var y2 = this.process(arguments[9]);
			var z2 = this.process(arguments[10]);
			var w2 = this.process(arguments[11]);
			var x3 = this.process(arguments[12]);
			var y3 = this.process(arguments[13]);
			var z3 = this.process(arguments[14]);
			var w3 = this.process(arguments[15]);
			var comps = [x0, y0, z0, w0, x1, y1, z1, w1, x2, y2, z2, w2, x3, y3, z3, w3];

			return Descriptor(
				`[${comps.join(', ')}]`, {
				components: comps,
				type: 'mat4',
				complexity: cmpl(comps)
			});
		};

		//ensure at least identity matrix
		if (v0 == null) v0 = 1;

		var v0 = this.process(v0);
		var v1 = this.process(v1);
		var v2 = this.process(v2);
		var v3 = this.process(v3);

		//mat(float) → identity matrix
		if (this.types[v0.type].length === 1) {
			var res = Descriptor(
				`mat4(${v0})`, {
				components: [
					v0, 0, 0, 0,
					0, v0, 0, 0,
					0, 0, v0, 0,
					0, 0, 0, v0
				].map(float, this),
				type: 'mat4',
				include: 'mat4',
				complexity: v0.complexity * 4 + 12
			});
			return res;
		}

		//mat4(mat2)
		if (v0.type === 'mat2') {
			return Descriptor(
				`[0,1,null,null, 2,3,null,null, null,null,-1,null, null,null,null,-1].map(function (i) {return i == null ? 0 : i < 0 ? -i : this[i]}, ${v0})`, {
				components: [
				v0.components[0], v0.components[1], 0, 0,
				v0.components[2], v0.components[3], 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1
				].map(float, this),
				type: 'mat4',
				complexity: 16 * 3 + v0.complexity
			});
		}

		//mat4(mat3)
		if (v0.type === 'mat3') {
			var components = v0.components;
			return Descriptor(
				`[0,1,2,null,3,4,5,null,6,7,8,null,null,null,null,-1].map(function (i) {return i == null ? 0 : i < 0 ? -i : this[i]}, ${v0})`, {
				components: components.slice(0, 3).concat(0, components.slice(3, 6), 0, components.slice(6, 9), 0, 0, 0, 0, 1).map(float, this),
				type: 'mat4',
				complexity: 16 * 3 + v0.complexity
			});
		}

		//mat(vec, vec, vec, vec)
		var comps = v0.components.slice(0, 4).concat(v1.components.slice(0, 4), v2.components.slice(0, 4), v3.components.slice(0,4));
		return Descriptor(`${this.types.vec4.call(this, v0)}.concat(${this.types.vec4.call(this, v1)}, ${this.types.vec4.call(this, v2)}, ${this.types.vec4.call(this, v3)})`, {
			components: comps.map(float, this),
			type: 'mat4',
			complexity: cmpl(comps)
		});
	}
	mat4.type = 'vec4';


	//helper to calc complexity of a list of components
	function cmpl (comps) {
		if (Array.isArray(comps)) {
			var sum = 0;
			for (var i = 0; i < comps.length; i++) {
				sum += comps[i].complexity || 0;
			}
			return sum;
		}
		else return comps.complexity;
	}

	//helper to calc simple types priority
	//@ref 4.1.10 Implicit Conversions in https://www.opengl.org/registry/doc/GLSLangSpec.4.40.pdf
	function subType (subType, genType) {
		subType += '';
		genType += '';
		if (subType === genType) return true;
		var typePriority = ['double', 'float', 'int', 'uint'];
		var subIdx = typePriority.indexOf(subType);
		var genIdx = typePriority.indexOf(genType);
		if (subIdx >= 0 && genIdx >= 0 && subIdx >= genIdx) return true;
		return false;
	}


	exports.mat2 = mat2;
	exports.mat3 = mat3;
	exports.mat4 = mat4;
	exports.mat2x2 = mat2;
	exports.mat3x3 = mat3;
	exports.mat4x4 = mat4;
	// exports.mat2x3 = mat2x3;
	// exports.mat2x4 = mat2x4;
	// exports.mat3x2 = mat3x2;
	// exports.mat3x4 = mat3x4;
	// exports.mat4x2 = mat4x2;
	// exports.mat4x3 = mat4x3;
	exports.dmat2 = mat2;
	exports.dmat3 = mat3;
	exports.dmat4 = mat4;
	exports.dmat2x2 = mat2;
	exports.dmat3x3 = mat3;
	exports.dmat4x4 = mat4;
	// exports.dmat2x3 = mat2x3;
	// exports.dmat2x4 = mat2x4;
	// exports.dmat3x2 = mat3x2;
	// exports.dmat3x4 = mat3x4;
	// exports.dmat4x2 = mat4x2;
	// exports.dmat4x3 = mat4x3;



	function createSampler (type, samplerType) {
		sampler.type = type;
		function sampler () {
			var name = arguments[0];
			return Descriptor(null, {
				type: samplerType,
				include: 'texture2D',
				complexity: 999
			});
		}
		return sampler;
	}



	exports.sampler1D = createSampler('vec4', 'sampler1D');
	exports.image1D = createSampler('vec4', 'image1D');
	exports.sampler2D = createSampler('vec4', 'sampler2D');
	exports.image2D = createSampler('vec4', 'image2D');
	exports.sampler3D = createSampler('vec4', 'sampler3D');
	exports.image3D = createSampler('vec4', 'image3D');
	exports.samplerCube = createSampler('vec4', 'samplerCube');
	exports.imageCube = createSampler('vec4', 'imageCube');
	exports.sampler2DRect = createSampler('vec4', 'sampler2DRect');
	exports.image2DRect = createSampler('vec4', 'image2DRect');
	exports.sampler1DArray = createSampler('vec4', 'sampler1DArray');
	exports.image1DArray = createSampler('vec4', 'image1DArray');
	exports.sampler2DArray = createSampler('vec4', 'sampler2DArray');
	exports.image2DArray = createSampler('vec4', 'image2DArray');
	// exports.samplerBuffer =
	// exports.imageBuffer =
	// exports.sampler2DMS =
	// exports.image2DMS =
	// exports.sampler2DMSArray =
	// exports.image2DMSArray =
	// exports.samplerCubeArray =
	// exports.imageCubeArray =
	exports.sampler1DShadow = createSampler('float', 'sampler1DShadow');
	exports.sampler2DShadow = createSampler('float', 'sampler2DShadow');
	exports.sampler2DRectShadow = createSampler('float', 'sampler2DRectShadow');
	exports.sampler1DArrayShadow = createSampler('float', 'sampler1DArrayShadow');
	exports.sampler2DArrayShadow = createSampler('float', 'sampler2DArrayShadow');
	exports.samplerCubeShadow = createSampler('float', 'samplerCubeShadow');
	exports.samplerCubeArrayShadow = createSampler('float', 'samplerCubeArrayShadow');
	exports.isampler1D = createSampler('ivec4', 'isampler1D');
	exports.iimage1D = createSampler('ivec4', 'iimage1D');
	exports.isampler2D = createSampler('ivec4', 'isampler2D');
	exports.iimage2D = createSampler('ivec4', 'iimage2D');
	exports.isampler3D = createSampler('ivec4', 'isampler3D');
	exports.iimage3D = createSampler('ivec4', 'iimage3D');
	exports.isamplerCube = createSampler('ivec4', 'isamplerCube');
	exports.iimageCube = createSampler('ivec4', 'iimageCube');
	// exports.isampler2DRect =
	// exports.iimage2DRect =
	// exports.isampler1DArray =
	// exports.iimage1DArray =
	// exports.isampler2DArray =
	// exports.iimage2DArray =
	// exports.isamplerBuffer =
	// exports.iimageBuffer =
	// exports.isampler2DMS =
	// exports.iimage2DMS =
	// exports.isampler2DMSArray =
	// exports.iimage2DMSArray =
	// exports.isamplerCubeArray =
	// exports.iimageCubeArray =
	// exports.usampler1D = createSampler('uvec4', 'usampler1D');
	// exports.uimage1D = createSampler('uvec4', 'uimage1D');
	// exports.usampler2D = createSampler('uvec4', 'usampler2D');
	// exports.uimage2D = createSampler('uvec4', 'uimage2D');
	// exports.usampler3D = createSampler('uvec4', 'usampler3D');
	// exports.uimage3D = createSampler('uvec4', 'uimage3D');
	// exports.usamplerCube = createSampler('uvec4', 'usamplerCube');
	// exports.uimageCube = createSampler('uvec4', 'uimageCube');
	// exports.usampler2DRect =
	// exports.uimage2DRect =
	// exports.usampler1DArray =
	// exports.uimage1DArray =
	// exports.usampler2DArray =
	// exports.uimage2DArray =
	// exports.usamplerBuffer =
	// exports.uimageBuffer =
	// exports.usampler2DMS =
	// exports.uimage2DMS =
	// exports.usampler2DMSArray =
	// exports.uimage2DMSArray =
	// exports.usamplerCubeArray =
	// exports.uimageCubeArray = sampler;
	// exports.atomic_uint =

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Descriptor of a node.
	 *
	 * @module  glsl-js/lib/descriptor
	 */
	var extend = __webpack_require__(22);
	var types = __webpack_require__(24);


	/**
	 * Constructor of descriptor - a result of mapping a glsl node to js.
	 *
	 * @param {string} str Result of rendering, complex version (unoptimized)
	 * @param {object} options Object with options:
	 *
	 * @param {array} options.components List of per-component descriptors, eg for vec2 it is descriptor as if each value was rendered separately
	 * @param {string} options.type Output type of descriptor
	 * @param {string} options.visible Whether component should be visible in output
	 * @param {number} options.complexity Empiric difficulty of calculation of the main descriptor string. Each component contains its own complexity metric.
	 * @param {string|array} options.include List of stdlib methods to include for a node, if complex version is applied
	 * @param {bool} options.optimize Whether to try to optimize the result.
	 */
	function Descriptor (str, options) {
		//strings which are rendered to something
		if (str != null) {
			var descriptor = new String((str+'').trim());
			descriptor.visible = true;
		}
		//strings which are rendered to nothing, like preprocessors etc
		else {
			var descriptor = new String();
			descriptor.visible = false;
		}

		//take over existing info
		if (str instanceof String) {
			extend(descriptor, str);
		}

		//take over options
		if (options) {
			descriptor.type = options.type;
			descriptor.components = options.components;
			descriptor.visible = options.visible;
			descriptor.complexity = options.complexity;
			descriptor.include = options.include;
			descriptor.optimize = options.optimize;
		}

		//in case of undefined complexity we should opt out for average value
		//suppose that user will set desired max complexity in custom cases
		if (descriptor.complexity == null || isNaN(descriptor.complexity)) {
			descriptor.complexity = Math.max(50, descriptor.length);
		}

		//set type based on number of components.
		if (descriptor.type == null) {
			if (!(descriptor+'')) {
				descriptor.type = 'void';
				descriptor.components = [];
			}
			else if (descriptor.components == null) {
				descriptor.type = 'float';
				descriptor.components = [descriptor];
			}
			else {
				var l = descriptor.components.length;
				if (l === 1) descriptor.type = 'float';
				else if (l <= 4) descriptor.type = 'vec' + l;
				else descriptor.type = 'mat' + Math.sqrt(l)|0;
			}
		}
		//type != null, components == null → set components as item-access
		else if (descriptor.components == null) {
			descriptor.components = [];
			var l = types[descriptor.type].length;
			if (/mat/.test(descriptor.type)) l *= types[types[type].type].length;
			if (l === 1) {
				descriptor.components = [descriptor];
			}
			else {
				for (var i = 0; i < l; i++) {
					descriptor.components[i] = Descriptor(`${descriptor}[${i}]`, {
						complexity: 1 + descriptor.complexity
					});
				}
			}
		}

		//set optimize flag if all children are optimizable
		if (descriptor.optimize == null) {
			descriptor.optimize = descriptor.components.every(function (comp) {
				return !!comp && comp.optimize !== false;
			});
		}

		return descriptor;
	}

	module.exports = Descriptor;


/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Just names for operators
	 *
	 * @module  glsl-js/lib/operators
	 */

	var Descriptor = __webpack_require__(25);

	var floatRE = /^-?[0-9]*(?:.[0-9]+)?(?:e-?[0-9]+)?$/i;

	var operators = processOperation.operators = {
		'*': 'multiply',
		'+': 'add',
		'-': 'subtract',
		'/': 'divide',
		'%': 'mod',
		'<<': 'lshift',
		'>>': 'rshift',
		'==':'equal',
		'<': 'less',
		'>': 'greater',

		//https://gcc.gnu.org/onlinedocs/cpp/C_002b_002b-Named-Operators.html#C_002b_002b-Named-Operators
		'&&': 'and',
		'&=': 'and_eq',
		'&': 'bitand',
		'|': 'bitor',
		// '~': 'compl',
		// '!': 'not',
		'!=': 'not_eq',
		'||': 'or',
		'|=': 'or_eq',
		'^': 'xor',
		'^=': 'xor_eq'
	};

	var opsRE = /\*|\+|\-|\/|\%|\<|\=|\>|\&|\||\!|\^|\~/;


	/**
	 * Return rendered operation
	 */
	function processOperation (left, right, operator) {
		var self = this;
		var leftType = left.type;
		var rightType = right.type;
		var operatorName = operators[operator];

		//1. scalar vs scalar
		if (this.types[leftType].length == 1 && this.types[rightType].length == 1) {
			var a = left, b = right;

			var res = Descriptor(calculate(a, b, operator), {
				components: [calculate(a, b, operator)],
				type: leftType,
				complexity: a.complexity + b.complexity + 1
			});
			return res;
		}

		//2. scalar vs vec/mat → apply scalar to each component
		if (this.types[leftType].length == 1 || this.types[rightType].length == 1) {
			var outType = this.types[leftType].length == 1 ? rightType : leftType;
			var vec = this.types[leftType].length == 1 ? right : left;
			var scalar = this.types[leftType].length == 1 ? left : right;
			var l = this.types[outType].length;
			if (/mat/.test(outType)) l *= this.types[this.types[outType].type].length;
			var operands = [];
			for (var i = 0; i < l; i++) {
				if (this.types[rightType].length == 1) {
					var rightOp = right, leftOp = left.components[i];
				}
				else {
					var rightOp = right.components[i], leftOp = left;
				}
				operands.push(calculate(leftOp, rightOp, operator));
			}

			if (scalar.optimize) {
				var calcStr = this.types[rightType].length == 1 ? calculate('_', scalar, operator) :  calculate(scalar, '_', operator);
				return Descriptor(
					`${vec}.map(function (_) {return ${calcStr};})`, {
					components: operands,
					type: outType,
					complexity: vec.complexity + l * (scalar.complexity + 2) + 1
				});
			}
			else {
				var calcStr = this.types[rightType].length == 1 ? calculate('_', 'this', operator) :  calculate('this', '_', operator);
				return Descriptor(
					`${vec}.map(function (_) {return ${calcStr};}, ${scalar})`, {
					components: operands,
					type: outType,
					complexity: vec.complexity + l * (scalar.complexity + 2) + 1
				});
			}
		}

		//3. vecN vs vecN → component-wise
		if (/vec/.test(leftType) && /vec/.test(rightType)) {
			var outType = this.types[leftType].length == 1 ? rightType : leftType;
			var l = this.types[outType].length;
			var operands = [];
			for (var i = 0; i < l; i++) {
				var leftOp = left.components[i], rightOp = right.components[i];
				operands.push(calculate(leftOp, rightOp, operator));
			}

			var include = {};
			include[leftType] = operatorName;
			var res = Descriptor(
				`${leftType}.${operatorName}([], ${left}, ${right})`, {
				components: operands,
				type: outType,
				complexity: left.complexity + right.complexity + l*3 + 1,
				include: include
			});
			return res;
		}

		//4. matN +-/ matN → component-wise
		if (/mat/.test(leftType) && /mat/.test(rightType) && operator !== '*') {
			var outType = this.types[leftType].length == 1 ? rightType : leftType;
			var l = this.types[outType].length * this.types[this.types[outType].type].length;
			var operands = [];
			for (var i = 0; i < l; i++) {
				var leftOp = left.components[i], rightOp = right.components[i];
				operands.push(calculate(leftOp, rightOp, operator));
			}

			var res = Descriptor(
				`${left}.map(function (x, i, m){ return x ${operator} this[i];}, ${right})`, {
				components: operands,
				complexity: left.complexity + right.complexity + l*3,
				type: outType
			});
			return res;
		}

		//5. matNxM * matNxM/vecM → matNxM linear multiplication
		if ((/mat/.test(leftType) || /mat/.test(rightType)) && operator === '*') {
			//vec * mat
			if (/vec/.test(leftType)) {
				var outType = leftType;
				var l = this.types[outType].length;
				var operands = [];
				var leftOp = left;
				var dotComponents = [];
				for (var i = 0; i < l; i++) {
					var start = l * i;
					var end = l * i + l;
					var rightOp = Descriptor(`${right}.slice(${start}, ${end})`, {
						type: this.types[leftType].type,
						complexity: right.complexity + l,
						components: right.components.slice(start, end)
					});
					rightOp = this.optimizeDescriptor(rightOp);

					operands.push(`dot(${leftOp}, ${rightOp})`);
					dotComponents.push(calculate(`this[${calculate('o', i, '+')}]`, `v[${i}]`, '*'))
				}
				this.addInclude('dot');
				var res = Descriptor(
					`${leftOp}.map(function (x, i, v) { var o = i * ${l}; return ${dotComponents.join(' + ')};}, ${right})`, {
					components: operands,
					complexity: left.complexity + right.complexity + l*(l + 3),
					type: outType
				});
				return res;
			}

			//mat * vec
			if (/vec/.test(rightType)) {
				var outType = leftType;

				var vec = right;
				var mat = left;
				var l = this.types[outType].length;

				var comps = [];
				for (var i = 0; i < l; i++) {
					var sum = [];
					for (var j = 0; j < l; j++) {
						var mc = mat.components[j*l + i];
						var vc = vec.components[j];
						sum.push(calculate(mc, vc, '*'));
					}
					comps.push(sum.join(' + '));
				}

				var res = Descriptor(
					`${vec}.map(function (x, i, v) { var sum = 0; for (var j = 0; j < ${l}; j++) {sum += ${calculate('this[j*' + l + '+i]', 'v[j]' ,'*')}} return sum; }, ${mat})`,
					{
						components: comps,
						type: outType,
						complexity: vec.complexity + mat.complexity + l*l*3
				});
				return res;
			}

			//mat * mat
			var outType = leftType;

			var l = left;
			var r = right;
			var len = this.types[this.types[outType].type].length;

			var comps = [];

			for (var i = 0; i < len; i++) {
				for (var j = 0; j < len; j++) {
					var sum = [];
					for (var o = 0; o < len; o++) {
						var mc = left.components[len*o + i],
							nc = right.components[j*len + o];
						sum.push(calculate(mc, nc, '*'));
					}
					comps[j*len + i] = sum.join(' + ');
				}
			}

			var res = Descriptor(
				`matrixMult(${l}, ${r})`, {
				components: comps,
				type: outType,
				include: 'matrixMult'
			});
			return res;
		}

		throw Error(`Impossible to render ${leftType} ${operator} ${rightType}.`);


		/**
		 * Try to evaluate operation
		 *
		 * @param {string} left Left operand, stringified js value
		 * @param {string} right Right operand, stringified js value
		 * @param {string} operator operator to eval
		 *
		 * @return {string} shorten pre-evaled operator
		 */
		function calculate (left, right, operator) {
			var opResult = undefined;

			//float op float case
			if (floatRE.test(left) && floatRE.test(right)) {
				opResult = eval(`${left} ${operator} ${right}`);
			}

			//handle ridiculous math cases like x + 0, x * 0, x + 1
			if (operator == '+' || operator == '-') {
				//0 + x
				if (left == 0) opResult = right;

				//x + 0
				if (right == 0) opResult = left;
			}

			else if (operator == '*') {
				//0 * x
				if (left == 0 || right == 0) opResult = 0;

				//1 * x
				else if (parseFloat(left) === 1) opResult = right;

				//x * 1
				else if (parseFloat(right) === 1) opResult = left;
			}

			//FIXME: in case if left or right components contain operations symbols we have to group them. That is groups issue.

			if (opResult == null) {
				opResult = `${left} ${operator} ${right}`;
			}

			opResult = Descriptor(opResult, {
				complexity: 1 + left.complexity||0 + right.complexity||0,
				optimize: left.optimize !== false && right.optimize !== false
			});

			return opResult;
		}
	}


	module.exports = processOperation;


/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * OpenGL/WebGL environment methods.
	 *
	 * @module  glsl-js/lib/stdlib
	 */

	var operators = __webpack_require__(26).operators;


	/**
	 * Types stubs
	 */
	function bool (val) {
		return !!val;
	}

	function int (val) {
		return val|0;
	}

	function float (val) {
		return +val;
	}

	function vec2 (x, y) {
		if (x == null) x = 0;
		if (y == null) y = x;
		return [x, y]
	}

	function vec3 (x, y, z) {
		if (x == null) x = 0;
		if (y == null) y = x;
		if (z == null) z = y;
		return [x, y, z]
	}

	function vec4 (x, y, z, w) {
		if (x == null) x = 0;
		if (y == null) y = x;
		if (z == null) z = y;
		if (w == null) w = z;
		return [x, y, z, w]
	}

	function mat2 (x) {
		if (x == null) x = 1;
		if (x.length === 4) return x;
		if (x.length === 2) return [x[0], 0, 0, x[1]];
		return [x, 0, 0, x]
	}

	function mat3 (x) {
		if (x == null) x = 1;
		if (x.length === 9) return x;
		if (x.length === 3) return [x[0], 0, 0, 0, x[1], 0, 0, 0, x[2]];
		return [x, 0, 0, 0, x, 0, 0, 0, x]
	}

	function mat4 (x) {
		if (x == null) x = 1;
		if (x.length === 16) return x;
		if (x.length === 4) return [x[0], 0, 0, 0, 0, x[1], 0, 0, 0, 0, x[2], 0, 0, 0, 0, x[3]];
		return [x, 0, 0, 0, 0, x, 0, 0, 0, 0, x, 0, 0, 0, 0, x]
	}


	/**
	 * Types operations.
	 */
	createOperations(vec2, 2);
	createOperations(vec3, 3);
	createOperations(vec4, 4);
	createOperations(mat2, 4);

	function createOperations(obj, len) {
		for (var operator in operators) {
			var comps = [];
			for (var i = 0; i < len; i++) {
				comps.push(`out[${i}] = a[${i}] ${operator} b[${i}]`);
			}

			obj[operators[operator]] = new Function ('out', 'a', 'b',
				`${comps.join(';\n')}\nreturn out;`
			);
		}
	}


	/**
	 * Math
	 */
	function radians (degrees) {
		if (degrees.length) return degrees.map(radians);
		return degrees * 0.017453292519943295;
	}

	function degrees (radians) {
		if (radians.length) return radians.map(degrees);
		return radians * 57.29577951308232;
	}

	function sin (angle) {
		if (angle.length) return angle.map(sin);
		return Math.sin(angle);
	}

	function cos (angle) {
		if (angle.length) return angle.map(cos);
		return Math.cos(angle);
	}

	function tan (angle) {
		if (angle.length) return angle.map(tan);
		return Math.tan(angle);
	}

	function asin (x) {
		if (x.length) return x.map(asin);
		return Math.asin(x);
	}

	function acos (x) {
		if (x.length) return x.map(acos);
		return Math.acos(x);
	}

	function atan (y, x) {
		if (arguments.length > 1) {
			if (y.length) return y.map(function (y, i) {
				return Math.atan2(y, x[i]);
			});

			return Math.atan2(y, x);
		}

		if (y.length) return y.map(function (y, i) {
			return Math.atan(y)
		});

		return Math.atan(y);
	}

	function pow (x, y) {
		if (x.length) return x.map(function (x, i) {
			return Math.pow(x, y[i]);
		});
		return Math.pow(x, y);
	}

	function exp (x) {
		if (x.length) return x.map(exp);
		return Math.exp(x);
	}

	function log (x) {
		if (x.length) return x.map(log);
		return Math.log(x);
	}

	var log2 = Math.log2 ? function log2 (x) {
			if (x.length) return x.map(log2);
			return Math.log2(x);
		} : function log2 (x) {
			if (x.length) return x.map(log2);
			return Math.log(x) / Math.LN2;
		};

	function exp2 (x) {
		if (x.length) return x.map(exp2);
		return Math.pow(2, x);
	}

	function sqrt (x) {
		if (x.length) return x.map(sqrt);
		return Math.sqrt(x);
	}

	function inversesqrt (x) {
		if (x.length) return x.map(inversesqrt);
		return 1 / Math.sqrt(x);
	}

	function abs (x) {
		if (x.length) return x.map(abs);
		return Math.abs(x);
	}

	function floor (x) {
		if (x.length) return x.map(floor);
		return Math.floor(x);
	}

	function ceil (x) {
		if (x.length) return x.map(ceil);
		return Math.ceil(x);
	}

	var sign = Math.sign ? function sign (x) {
		if (x.length) return x.map(sign);
		return Math.sign(x);
	} : function sign (x) {
		if (x.length) return x.map(sign);

		x = +x; // convert to a number

		if (x === 0 || isNaN(x)) {
			return x;
		}

		return x > 0 ? 1 : -1;
	};

	function fract (x) {
		if (x.length) return x.map(fract);
		return x - Math.floor(x);
	}

	function mod (x, y) {
		if (x.length) {
			if (y.length) return x.map(function (x, i) {
				return x % y[i];
			});
			return x.map(function (x, i) {
				return x % y;
			});
		}
		return x % y;
	}

	function min (x, y) {
		if (x.length) {
			if (y.length) return x.map(function (x, i) {
				return Math.min(x, y[i]);
			});
			return x.map(function (x, i) {
				return Math.min(x, y);
			});
		}
		return Math.min(x, y);
	}

	function max (x, y) {
		if (x.length) {
			if (y.length) return x.map(function (x, i) {
				return Math.max(x, y[i]);
			});
			return x.map(function (x, i) {
				return Math.max(x, y);
			});
		}
		return Math.max(x, y);
	}

	function clamp (x, min, max) {
		if (x.length) {
			if (min.length) return x.map(function (x, i) {
				return Math.min(Math.max(x, min[i]), max[i]);
			});
			return x.map(function (x, i) {
				return Math.min(Math.max(x, min), max);
			});
		}

		return Math.min(Math.max(x, min), max);
	}

	function mix (x, y, a) {
		if (x.length) {
			if (a.length) return x.map(function (x, i) {
				return mix(x, y[i], a[i]);
			});
			return x.map(function (x, i) {
				return mix(x, y[i], a);
			});
		}

		return x * (1.0 - a) + y * a;
	}

	function step (edge, x) {
		if (x.length) {
			if (edge.length) return x.map(function (x, i) {
				return step(edge[i], x);
			});
			return x.map(function (x, i) {
				return step(edge, x);
			});
		}

		return x < edge ? 0.0 : 1.0;
	}
	step.type = function (node) {
		return this.process(node.children[1]).type;
	}

	function smoothstep (edge0, edge1, x) {
		if (x.length) {
			if (edge0.length) return x.map(function (x, i) {
				return smoothstep(edge0[i], edge1[i], x);
			});
			return x.map(function (x, i) {
				return smoothstep(edge0, edge1, x);
			});
		}

		var t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0.0), 1.0);
		return t * t * (3.0 - 2.0 * t);
	}

	function length (x) {
		var sum = 0;
		for (var i = 0; i < x.length; i++) {
			sum += x[i]*x[i];
		}
		return Math.sqrt(sum);
	}
	length.type = 'float';

	function distance(x, y) {
		var sum = 0;
		for (var i = 0; i < x.length; i++) {
			sum += (x[i]-y[i])*(x[i]-y[i]);
		}
		return Math.sqrt(sum);
	}
	distance.type = 'float';

	function dot (x, y) {
		var sum = 0;
		for (var i = 0; i < x.length; i++) {
			sum += x[i]*y[i];
		}
		return sum;
	}
	dot.type = 'float';

	function cross (x, y) {
		var x0 = x[0], x1 = x[1], x2 = x[2],
		y0 = y[0], y1 = y[1], y2 = y[2];
		var out = [0, 0, 0];
		out[0] = x1 * y2 - x2 * y1;
		out[1] = x2 * y0 - x0 * y2;
		out[2] = x0 * y1 - x1 * y0;
		return out;
	}
	cross.type = 'vec3';

	function normalize (x) {
		var len = 0;
		for (var i = 0; i < x.length; i++) {
			len += x[i]*x[i];
		}

		var out = Array(x.length).fill(0);
		if (len > 0) {
			len = 1 / Math.sqrt(len);
			for (var i = 0; i < x.length; i++) {
				out[i] = x[i] * len;
			}
		}
		return out;
	}

	function faceforward (N, I, Nref) {
		if (Nref == null) Nref = N;

		var dot = 0;
		for (var i = 0; i < N.length; i++) {
			dot += Nref[i]*I[i];
		}

		return dot > 0 ? N.map(function (x) { return -x;}) : N;
	}

	function reflect (I, N) {
		var dot = 0;
		for (var i = 0; i < N.length; i++) {
			dot += N[i]*I[i];
		}

		var out = Array(N.length);
		for (var i = 0; i < N.length; i++) {
			out[i] = I[i] - 2 * dot * N[i];
		}

		return out;
	}

	function refract (I, N, eta) {
		var dot = 0;
		for (var i = 0; i < N.length; i++) {
			dot += N[i]*I[i];
		}

		var k = 1 - eta*eta*(1 - dot*dot);

		var out = Array(N.length).fill(0);

		if (k > 0) {
			for (var i = 0; i < N.length; i++) {
				out[i] = eta*I[i] - (eta*dot + Math.sqrt(k)) * N[i];
			}
		}

		return out;
	}


	/**
	 * Vector relational functions
	 */
	function lessThan (x, y) {
		if (x.length) {
			var out = Array(x.length);
			for (var i = 0; i < x.length; i++) {
				out[i] = x[i] < y[i];
			}
			return out;
		}
		return x < y;
	}

	function lessThanEqual (x, y) {
		if (x.length) {
			var out = Array(x.length);
			for (var i = 0; i < x.length; i++) {
				out[i] = x[i] <= y[i];
			}
			return out;
		}
		return x <= y;
	}

	function greaterThan (x, y) {
		if (x.length) {
			var out = Array(x.length);
			for (var i = 0; i < x.length; i++) {
				out[i] = x[i] > y[i];
			}
			return out;
		}
		return x > y;
	}

	function greaterThanEqual (x, y) {
		if (x.length) {
			var out = Array(x.length);
			for (var i = 0; i < x.length; i++) {
				out[i] = x[i] >= y[i];
			}
			return out;
		}
		return x >= y;
	}

	function equal (x, y) {
		if (x.length) {
			var out = Array(x.length);
			for (var i = 0; i < x.length; i++) {
				out[i] = x[i] == y[i];
			}
			return out;
		}
		return x == y;
	}

	function notEqual (x, y) {
		if (x.length) {
			var out = Array(x.length);
			for (var i = 0; i < x.length; i++) {
				out[i] = x[i] != y[i];
			}
			return out;
		}
		return x != y;
	}

	function any(x) {
		return x.some(function (x) {return x;});
	}

	function all(x) {
		return x.every(function (x) {return x;});
	}

	function not (x) {
		if (x.length) {
			var out = Array(x.length);
			for (var i = 0; i < x.length; i++) {
				out[i] = !x[i];
			}
			return out;
		}
		return !x
	}


	/**
	 * Matrices
	 */
	function matrixCompMult (x, y) {
		var out = Array(x.length);
		for (var i = 0; i < x.length; i++) {
			out[i] = x[i]*y[i];
		}
		return out;
	}

	function outerProduct (c, r) {
		var out = [];
		var l = c.length;
		for (var i = 0; i < c.length; i++) {
			for (var j = 0; j < r.length; j++) {
				out[i*l + j] = c[i]*r[j];
			}
		}
		return out;
	}
	outerProduct.type = function (node) {
		var child1Type = this.process(node.children[1]).type;
		var child2Type = this.process(node.children[2]).type;
		var dim1 = child1Type.slice(-1);
		var dim2 = child2Type.slice(-1);
		return `mat${dim1}x${dim2}`;
	};

	function transpose (m) {
		var l = m.length === 16 ? 4 : m.length === 9 ? 3 : 2;
		var out = Array(m.length);
		for (var i = 0; i < l; i++) {
			for (var j = 0; j < l; j++) {
				out[j*l + i] = m[i*l + j];
			}
		}
		return out;
	}

	function determinant (m) {
		if (m.length === 4) {
			return m[0]*m[3] - m[1]*m[2];
		}

		if (m.length === 9) {
			var a00 = m[0], a01 = m[1], a02 = m[2], a10 = m[3], a11 = m[4], a12 = m[5], a20 = m[6], a21 = m[7], a22 = m[8];

			return a00*a11*a22 + a01*a12*a20 + a02*a10*a21 - a02*a11*a20 - a01*a10*a22 - a00*a12*a21;
		}

		var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3],
			a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
			a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11],
			a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15],

			b00 = a00 * a11 - a01 * a10,
			b01 = a00 * a12 - a02 * a10,
			b02 = a00 * a13 - a03 * a10,
			b03 = a01 * a12 - a02 * a11,
			b04 = a01 * a13 - a03 * a11,
			b05 = a02 * a13 - a03 * a12,
			b06 = a20 * a31 - a21 * a30,
			b07 = a20 * a32 - a22 * a30,
			b08 = a20 * a33 - a23 * a30,
			b09 = a21 * a32 - a22 * a31,
			b10 = a21 * a33 - a23 * a31,
			b11 = a22 * a33 - a23 * a32;

		return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
	}
	determinant.type = 'float';

	//FIXME: optimize the method inclusion, per-matrix
	//FIXME: inverse the dimensions of the input matrix: mat2x3 → mat3x2
	function inverse (a) {
		var l = a.length;
		var out = Array(l);

		if (l === 4) {
			var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],

			det = a0 * a3 - a2 * a1;

			if (!det) {
				return out;
			}
			det = 1.0 / det;

			out[0] =  a3 * det;
			out[1] = -a1 * det;
			out[2] = -a2 * det;
			out[3] =  a0 * det;

			return out;
		}

		if (l === 9) {
			var a00 = a[0], a01 = a[1], a02 = a[2],
			a10 = a[3], a11 = a[4], a12 = a[5],
			a20 = a[6], a21 = a[7], a22 = a[8],

			b01 = a22 * a11 - a12 * a21,
			b11 = -a22 * a10 + a12 * a20,
			b21 = a21 * a10 - a11 * a20,

			det = a00 * b01 + a01 * b11 + a02 * b21;

			if (!det) {
				return out;
			}
			det = 1.0 / det;

			out[0] = b01 * det;
			out[1] = (-a22 * a01 + a02 * a21) * det;
			out[2] = (a12 * a01 - a02 * a11) * det;
			out[3] = b11 * det;
			out[4] = (a22 * a00 - a02 * a20) * det;
			out[5] = (-a12 * a00 + a02 * a10) * det;
			out[6] = b21 * det;
			out[7] = (-a21 * a00 + a01 * a20) * det;
			out[8] = (a11 * a00 - a01 * a10) * det;
			return out;
		}

		var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
			a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
			a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
			a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

			b00 = a00 * a11 - a01 * a10,
			b01 = a00 * a12 - a02 * a10,
			b02 = a00 * a13 - a03 * a10,
			b03 = a01 * a12 - a02 * a11,
			b04 = a01 * a13 - a03 * a11,
			b05 = a02 * a13 - a03 * a12,
			b06 = a20 * a31 - a21 * a30,
			b07 = a20 * a32 - a22 * a30,
			b08 = a20 * a33 - a23 * a30,
			b09 = a21 * a32 - a22 * a31,
			b10 = a21 * a33 - a23 * a31,
			b11 = a22 * a33 - a23 * a32,

		det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

		if (!det) {
			return out;
		}
		det = 1.0 / det;

		out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
		out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
		out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
		out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
		out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
		out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
		out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
		out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
		out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
		out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
		out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
		out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
		out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
		out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
		out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
		out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

		return out;
	}

	/**
	 * mat * mat
	 */
	function matrixMult (m, n) {
		var l = m.length === 16 ? 4 : m.length === 9 ? 3 : 2;
		var out = Array(m.length);
		for (var i = 0; i < l; i++) {
			for (var j = 0; j < l; j++) {
				var sum = 0;
				for (var o = 0; o < l; o++) {
					sum += m[l*o + i] * n[j*l + o];
				}
				out[j*l + i] = sum;
			}
		}
		return out;
	}


	/**
	 * Get texture value.
	 * It has the output type of first arg.
	 */
	function texture (sampler, coord, bias) {
		var size = textureSize(sampler);
		var x = ((coord[0] % 1) * size[0])|0;
		var y = ((coord[1] % 1) * size[1])|0;
		var idx = y * 4 * size[0] + x * 4;
		if (sampler.data) {
			return sampler.data.slice(idx, idx + 4);
		}
		return sampler.slice(idx, idx + 4);
	}
	texture.include = ['textureSize'];
	texture.type = function (node) {
		var samplerType = this.process(node.children[1]).type;
		return this.types[samplerType].type;
	};

	function textureSize (sampler, lod) {
		if (sampler.shape) return [sampler.shape[0], sampler.shape[1]];
		return [sampler.width, sampler.height];
	};
	texture.type = function (node) {
		var samplerType = this.process(node.children[1]).type;
		if (/1D/.test(samplerType)) return 'int';
		if (/2D|Cube/.test(samplerType)) return 'ivec2';
		return 'ivec3';
	};


	exports.bool = bool;
	exports.int = int;
	exports.uint = int;
	exports.float = float;
	exports.double = float;
	exports.vec2 = vec2;
	exports.vec3 = vec3;
	exports.vec4 = vec4;
	exports.dvec2 = vec2;
	exports.dvec3 = vec3;
	exports.dvec4 = vec4;
	exports.ivec2 = vec2;
	exports.ivec3 = vec3;
	exports.ivec4 = vec4;
	exports.uvec2 = vec2;
	exports.uvec3 = vec3;
	exports.uvec4 = vec4;
	exports.mat2 = mat2;
	exports.mat3 = mat3;
	exports.mat4 = mat4;
	exports.mat3x3 = mat3;
	exports.mat4x4 = mat4;

	exports.radians = radians;
	exports.degrees = degrees;
	exports.sin = sin;
	exports.cos = cos;
	exports.tan = tan;
	exports.asin = asin;
	exports.acos = acos;
	exports.atan = atan;
	exports.pow = pow;
	exports.exp = exp;
	exports.log = log;
	exports.log2 = log2;
	exports.exp2 = exp2;
	exports.sqrt = sqrt;
	exports.inversesqrt = inversesqrt;
	exports.abs = abs;
	exports.sign = sign;
	exports.floor = floor;
	exports.ceil = ceil;
	exports.fract = fract;
	exports.mod = mod;
	exports.min = min;
	exports.max = max;
	exports.clamp = clamp;
	exports.mix = mix;
	exports.step = step;
	exports.smoothstep = smoothstep;
	exports.length = length;
	exports.distance = distance;
	exports.dot = dot;
	exports.cross = cross;
	exports.faceforward = faceforward;
	exports.normalize = normalize;
	exports.reflect = reflect;
	exports.refract = refract;
	exports.lessThan = lessThan;
	exports.lessThanEqual = lessThanEqual;
	exports.greaterThan = greaterThan;
	exports.greaterThanEqual = greaterThanEqual;
	exports.equal = equal;
	exports.notEqual = notEqual;
	exports.any = any;
	exports.all = all;
	exports.not = not;
	exports.matrixCompMult = matrixCompMult;
	exports.matrixMult = matrixMult;
	exports.outerProduct = outerProduct;
	exports.transpose = transpose;
	exports.determinant = determinant;
	exports.inverse = inverse;

	exports.texture1D =
	exports.texture2D =
	exports.texture3D =
	exports.textureCube =
	exports.shadow1D =
	exports.shadow2D =
	exports.shadow3D =
	exports.texture = texture;
	exports.textureSize = textureSize;

/***/ },
/* 28 */
/***/ function(module, exports) {

	'use strict'

	/**
	 * Expose `arrayFlatten`.
	 */
	module.exports = flatten
	module.exports.from = flattenFrom
	module.exports.depth = flattenDepth
	module.exports.fromDepth = flattenFromDepth

	/**
	 * Flatten an array.
	 *
	 * @param  {Array} array
	 * @return {Array}
	 */
	function flatten (array) {
	  if (!Array.isArray(array)) {
	    throw new TypeError('Expected value to be an array')
	  }

	  return flattenFrom(array)
	}

	/**
	 * Flatten an array-like structure.
	 *
	 * @param  {Array} array
	 * @return {Array}
	 */
	function flattenFrom (array) {
	  return flattenDown(array, [])
	}

	/**
	 * Flatten an array-like structure with depth.
	 *
	 * @param  {Array}  array
	 * @param  {number} depth
	 * @return {Array}
	 */
	function flattenDepth (array, depth) {
	  if (!Array.isArray(array)) {
	    throw new TypeError('Expected value to be an array')
	  }

	  return flattenFromDepth(array, depth)
	}

	/**
	 * Flatten an array-like structure with depth.
	 *
	 * @param  {Array}  array
	 * @param  {number} depth
	 * @return {Array}
	 */
	function flattenFromDepth (array, depth) {
	  if (typeof depth !== 'number') {
	    throw new TypeError('Expected the depth to be a number')
	  }

	  return flattenDownDepth(array, [], depth)
	}

	/**
	 * Flatten an array indefinitely.
	 *
	 * @param  {Array} array
	 * @param  {Array} result
	 * @return {Array}
	 */
	function flattenDown (array, result) {
	  for (var i = 0; i < array.length; i++) {
	    var value = array[i]

	    if (Array.isArray(value)) {
	      flattenDown(value, result)
	    } else {
	      result.push(value)
	    }
	  }

	  return result
	}

	/**
	 * Flatten an array with depth.
	 *
	 * @param  {Array}  array
	 * @param  {Array}  result
	 * @param  {number} depth
	 * @return {Array}
	 */
	function flattenDownDepth (array, result, depth) {
	  depth--

	  for (var i = 0; i < array.length; i++) {
	    var value = array[i]

	    if (depth > -1 && Array.isArray(value)) {
	      flattenDownDepth(value, result, depth)
	    } else {
	      result.push(value)
	    }
	  }

	  return result
	}


/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(process) {/**
	 * Preprocess in C-preprocessor fashion
	 * @module  prepr
	 */

	var paren = __webpack_require__(30);
	var balanced = __webpack_require__(31);
	var extend = __webpack_require__(22);

	/**
	 * Main processing function
	 */
	function preprocess (what, how) {
		var result = '';
		var source = what + '';

		//defined macros
		//FIXME: provide real values here
		var macros = extend({
			__LINE__: 0,
			__FILE__: '_',
			__VERSION__: 100,
			defined: function (arg) {
				return [].slice.call(arguments).every(function (arg) {
					return macros[arg] != null;
				});
			}
		}, how);

		return process(source);


		//process chunk of a string by finding out macros and replacing them
		function process (str) {
			if (!str) return '';

			var arr = [];

			var chunk = str;

			//find next directive, get chunk to process before it
			var directive = /#[A-Za-z0-9_$]+/ig.exec(str);

			//get chunk to process - before next call
			if (directive) {
				chunk = chunk.slice(0, directive.index);
				str = str.slice(directive.index);
			}


			//escape bad things
			chunk = escape(chunk, arr);

			//replace all defined X to defined (X)
			chunk = chunk.replace(/\bdefined\s*([A-Za-z0-9_$]+)/g, 'defined($1)');


			//for each registered macro do it’s call
			for (var name in macros) {
				//fn macro
				if (macros[name] instanceof Function) {
					chunk = processFunction(chunk, name, macros[name]);
				}
			}

			chunk = escape(chunk, arr);

			//for each defined var do replacement
			for (var name in macros) {
				//value replacement
				if (!(macros[name] instanceof Function)) {
					chunk = processDefinition(chunk, name, macros[name]);
				}
			}

			chunk = unescape(chunk, arr);


			//process directive
			if (directive) {
				if (/^#def/.test(directive[0])) {
					str = !(__WEBPACK_AMD_DEFINE_FACTORY__ = (str), __WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ? (__WEBPACK_AMD_DEFINE_FACTORY__.call(exports, __webpack_require__, exports, module)) : __WEBPACK_AMD_DEFINE_FACTORY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
				}
				else if (/^#undef/.test(directive[0])) {
					str = undefine(str);
				}
				else if (/^#if/.test(directive[0])) {
					str = processIf(str);
				}
				else if (/^#line/.test(directive[0])) {
					var data = /#[A-Za-z0-9_]+\s*([-0-9]+)?[^\n]*/.exec(str);
					macros.__LINE__ = parseInt(data[1]);
					str = str.slice(data.index + data[0].length);
				}
				else if (/^#version/.test(directive[0])) {
					var data = /#[A-Za-z0-9_]+\s*([-0-9]+)?[^\n]*/.exec(str);
					macros.__VERSION__ = parseInt(data[1]);
					str = str.slice(data.index + data[0].length);
				}
				else {
					//drop directive line
					var directiveDecl = /\n/m.exec(str);
					chunk += str.slice(0, directiveDecl.index) + '\n';
					str = str.slice(directiveDecl.index)
				}

				return chunk + process(str);
			}

			return chunk;
		}

		//replace defined macros from a string
		function processFunction (str, name, fn) {
			var arr = [];
			str = escape(str, arr);

			var parts = paren(str, {
				flat: true,
				brackets: '()',
				escape: '___'
			});

			var re = new RegExp(name + '\\s*\\(___([0-9]+)\\)', 'g');

			//replace each macro call with result
			parts = parts.map(function (part) {
				return part.replace(re, function (match, argsPartIdx) {
					//parse arguments
					var args = parts[argsPartIdx];
					if (args.trim().length) {
						args = args.split(/\s*,\s*/);
						args = args.map(function (arg) {
							var argParts = parts.slice();
							argParts[0] = arg;
							return paren.stringify(argParts, {flat: true, escape: '___'});
						}).map(function (arg) {
							return arg;
						});
					} else {
						args = [];
					}

					if (args.length != fn.length) throw Error(`macro "${name}" requires ${fn.length} arguments, but ${args.length} given`);

					//apply macro call with args
					return fn.apply(null, args);
				});
			});

			str = paren.stringify(parts, {flat: true, escape: '___'});

			str = unescape(str, arr);

			return str;
		}

		//replace defined variables from a string
		function processDefinition (str, name, value) {
			var arr = [];
			str = escape(str, arr);

			//apply concatenation ENTRY ## something → valueSomething
			str = str.replace(new RegExp(`([^#A-Za-z0-9_$]|^)${name}\\s*##\\s*([A-Za-z0-9_$]*)`, 'g'), function (match, pre, post) {
				return pre + value + post;
			});
			str = str.replace(new RegExp(`([A-Za-z0-9_$]*)\\s*##\\s*${name}([^A-Za-z0-9_$]|$)`, 'g'), function (match, pre, post) {
				return pre + value + post;
			});

			//replace definition entries
			str = str.replace(new RegExp(`([^#A-Za-z0-9_$]|^)${name}([^A-Za-z0-9_$]|$)`, 'g'), function (match, pre, post) {

				//insert definition
				if (macros[value] != null && !(macros[value] instanceof Function)) value = macros[value];

				return pre + value + post;
			});
			//replace stringifications
			str = str.replace(new RegExp(`#${name}([^A-Za-z0-9_$]|$)`, 'g'), function (match, post) {
				return  '"' + value + '"' + post;
			});

			str = unescape(str, arr);

			return str;
		}

		//helpers to escape unfoldable things in strings
		function escape (str, arr) {
			//hide comments
			str = str.replace(/\/\/[^\n]*$/mg, function (match) {
				return ' ___comment' + arr.push(match);
			});
			str = str.replace(/\/\*([^\*]|[\r\n]|(\*+([^\*\/]|[\r\n])))*\*+\//g, function (match) {
				return ' ___comment' + arr.push(match);
			});
			//Escape strings
			str = str.replace(/\'[^']*\'/g, function (match) {
				return ' ___string' + arr.push(match);
			});
			str = str.replace(/\"[^"]*\"/g, function (match) {
				return ' ___string' + arr.push(match);
			});
			str = str.replace(/\`[^`]*\`/g, function (match) {
				return ' ___string' + arr.push(match);
			});
			return str;
		}

		function unescape (str, arr) {
			//unescape strings
			arr.forEach(function (rep, i) {
				str = str.replace(' ___string' + (i+1), rep);
			});

			//unhide comments
			arr.forEach(function (value, i) {
				str = str.replace(' ___comment' + (i+1), value);
			});
			return str;
		}



		//register macro, #define directive
		function define (str) {
			var data = /#[A-Za-z]+[ ]*([A-Za-z0-9_$]*)(?:\(([^\(\)]*)\))?[ \r]*([^\n]*)$/m.exec(str);
			str = str.slice(data.index + data[0].length);

			var name = data[1];
			var args = data[2];
			var value = data[3];

			if (!name || !value) throw Error(`Macro definition "${data[0]}" is malformed`);

			//register function macro
			//#define FOO(A, B) (expr)
			if (args != null) {
				if (args.trim().length) {
					args = args.split(/\s*,\s*/);
				}
				else {
					args = [];
				}

				function fn () {
					var result = value;

					//for each arg - replace it’s occurence in `result`
					for (var i = 0; i < args.length; i++) {
						result = processDefinition(result, args[i], arguments[i]);
					}

					result = process(result);

					return result;
				};
				Object.defineProperty(fn, 'length', {
					value: args.length
				});

				macros[name] = fn;
			}

			//register value macro
			//#define FOO insertion
			//#define FOO (expr)
			else {
				macros[name] = value;
			}

			return str;
		}

		//unregister macro, #undef directive
		function undefine (str) {
			var data = /#[A-Za-z0-9_]+[ ]*([A-Za-z0-9_$]+)/.exec(str);
			delete macros[data[1]];

			return str.slice(data.index + data[0].length);
		}

		//process if/else/ifdef/elif/ifndef/defined
		function processIf (str) {
			var match = balanced('#if', '#endif', str)

			//if no nested ifs - means we are in clause, return as is
			if (!match) return str;

			var body = match.body;
			var post = match.post;
			var elseBody = '';

			//find else part
			var matchElse;
			if (matchElse = /^\s*#else[^\n\r]*$/m.exec(body)) {
				elseBody = body.slice(matchElse.index + matchElse[0].length);
				body = body.slice(0, matchElse.index);
			}

			//ifdef
			if(/^def/.test(body)) {
				body = body.slice(3);
				var nameMatch = /[A-Za-z0-9_$]+/.exec(body);
				var name = nameMatch[0];
				body = body.slice(name.length + nameMatch.index);
				if (macros[name] != null) str = process(body);
				else str = process(elseBody);
			}
			//ifndef
			else if (/^ndef/.test(body)) {
				body = body.slice(4);
				var nameMatch = /[A-Za-z0-9_$]+/.exec(body);
				var name = nameMatch[0];
				body = body.slice(name.length + nameMatch.index);
				if (macros[name] == null) str = process(body);
				else str = process(elseBody);
			}
			//if
			else {
				//split elifs
				var clauses = body.split(/^\s*#elif\s+/m);

				var result = false;

				//find first triggered clause
				for (var i = 0; i < clauses.length; i++) {
					var clause = clauses[i];

					var exprMatch = /\s*(.*)/.exec(clause);
					var expr = exprMatch[0];
					clause = clause.slice(expr.length + exprMatch.index);

					//eval expression
					expr = process(expr);

					try {
						result = eval(expr);
					} catch (e) {
						result = false;
					}

					if (result) {
						str = process(clause);
						break;
					}
				}

				//else clause
				if (!result) {
					str = process(elseBody);
				}
			}


			//trim post till the first endline, because there may be comments after #endif
			var match = /[\n\r]/.exec(post);
			if (match) post = post.slice(match.index);

			return str + post;
		}
	}


	module.exports = preprocess;
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(7)))

/***/ },
/* 30 */
/***/ function(module, exports) {

	/**
	 * @module parenthesis
	 */

	function parse (str, opts) {
		//pretend non-string parsed per-se
		if (typeof str !== 'string') return [str];

		var res = [str];

		opts = opts || {};

		var brackets = opts.brackets ? (Array.isArray(opts.brackets) ? opts.brackets : [opts.brackets]) : ['{}', '[]', '()'];

		var escape = opts.escape || '___';

		var flat = !!opts.flat;

		brackets.forEach(function (bracket) {
			//create parenthesis regex
			var pRE = new RegExp(['\\', bracket[0], '[^\\', bracket[0], '\\', bracket[1], ']*\\', bracket[1]].join(''));

			var ids = [];

			function replaceToken(token, idx, str){
				//save token to res
				var refId = res.push(token.slice(bracket[0].length, -bracket[1].length)) - 1;

				ids.push(refId);

				return escape + refId;
			}

			res.forEach(function (str, i) {
				var prevStr;

				//replace paren tokens till there’s none
				var a = 0;
				while (str != prevStr) {
					prevStr = str;
					str = str.replace(pRE, replaceToken);
					if (a++ > 10e3) throw Error('References have circular dependency. Please, check them.')
				}

				res[i] = str;
			});

			//wrap found refs to brackets
			ids = ids.reverse();
			res = res.map(function (str) {
				ids.forEach(function (id) {
					str = str.replace(new RegExp('(\\' + escape + id + '(?![0-9]))', 'g'), bracket[0] + '$1' + bracket[1])
				});
				return str;
			});
		});

		var re = new RegExp('\\' + escape + '([0-9]+)');

		//transform references to tree
		function nest (str, refs, escape) {
			var res = [], match;

			var a = 0;
			while (match = re.exec(str)) {
				if (a++ > 10e3) throw Error('Circular references in parenthesis');

				res.push(str.slice(0, match.index));

				res.push(nest(refs[match[1]], refs));

				str = str.slice(match.index + match[0].length);
			}

			res.push(str);

			return res;
		}

		return flat ? res : nest(res[0], res);
	};


	function stringify (arg, opts) {
		if (opts && opts.flat) {
			var escape = opts && opts.escape || '___';

			var str = arg[0], prevStr;

			//pretend bad string stringified with no parentheses
			if (!str) return '';

			function replaceRef(match, idx){
				if (arg[idx] == null) throw Error('Reference ' + idx + 'is undefined')
				return arg[idx];
			}

			var re = new RegExp('\\' + escape + '([0-9]+)');

			var a = 0;
			while (str != prevStr) {
				if (a++ > 10e3) throw Error('Circular references in ' + arg);
				prevStr = str;
				str = str.replace(re, replaceRef);
			}

			return str;
		}

		return arg.reduce(function f (prev, curr) {
			if (Array.isArray(curr)) {
				curr = curr.reduce(f, '');
			}
			return prev + curr;
		}, '');
	}


	function parenthesis (arg, opts) {
		if (Array.isArray(arg)) {
			return stringify(arg, opts);
		}
		else {
			return parse(arg, opts);
		}
	}

	parenthesis.parse = parse;
	parenthesis.stringify = stringify;

	module.exports = parenthesis;

/***/ },
/* 31 */
/***/ function(module, exports) {

	module.exports = balanced;
	function balanced(a, b, str) {
	  var r = range(a, b, str);

	  return r && {
	    start: r[0],
	    end: r[1],
	    pre: str.slice(0, r[0]),
	    body: str.slice(r[0] + a.length, r[1]),
	    post: str.slice(r[1] + b.length)
	  };
	}

	balanced.range = range;
	function range(a, b, str) {
	  var begs, beg, left, right, result;
	  var ai = str.indexOf(a);
	  var bi = str.indexOf(b, ai + 1);
	  var i = ai;

	  if (ai >= 0 && bi > 0) {
	    begs = [];
	    left = str.length;

	    while (i < str.length && i >= 0 && ! result) {
	      if (i == ai) {
	        begs.push(i);
	        ai = str.indexOf(a, i + 1);
	      } else if (begs.length == 1) {
	        result = [ begs.pop(), bi ];
	      } else {
	        beg = begs.pop();
	        if (beg < left) {
	          left = beg;
	          right = bi;
	        }

	        bi = str.indexOf(b, i + 1);
	      }

	      i = ai < bi && ai >= 0 ? ai : bi;
	    }

	    if (begs.length) {
	      result = [ left, right ];
	    }
	  }

	  return result;
	}


/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Convert stream of AST nodes to strings.
	 *
	 * @module
	 */

	var tokenize = __webpack_require__(15);
	var parse = __webpack_require__(10);
	var GLSL = __webpack_require__(2);
	var Transform = __webpack_require__(33).Transform;
	var inherits = __webpack_require__(4);

	function GlslJsStream (options) {
		if (!(this instanceof GlslJsStream)) return new GlslJsStream(options);

		Transform.call(this, {
			objectMode: true
		});

		//actual version of tree
		this.tree = null;

		//actual version of code
		this.source = '';

		this.on('data', function (data) {
			this.source += data + '\n';
		});

		//glsl compiler
		this.compiler = GLSL(options).compiler;
	};

	inherits(GlslJsStream, Transform);


	// glsl-parser streams data for each token from the glsl-tokenizer,
	// it generates lots of duplicated ASTs, which does not make any sense in the output.
	// So the satisfactory behaviour here is to render each statement in turn.
	GlslJsStream.prototype._transform = function (chunk, enc, cb) {
		//if string passed - tokenize and parse it
		if (typeof chunk === 'string') {
			//FIXME: there is a problem of invalid input chunks; gotta wait till some sensible thing is accumulated and then parse.
			var tree = parse(tokenize(chunk));
			cb(null, this.compiler.process(tree));

			this.tree = tree;
		}
		//if tree - compile the tree
		else {
			//if function statements expected - wait for stmtlist of it to render fully
			if (this._isFunctionMode) {
				if (chunk.type === 'function') {
					this._isFunctionMode = false;
				}
				cb(null);
			}

			else {
				if (chunk.type === 'stmt')	{
					cb(null, this.compiler.process(chunk));
				}
				else {
					//detect entering function mode to avoid reacting on stmts
					if (chunk.type === 'functionargs') {
						this._isFunctionMode = true;
					}
					//save last stmtlist to pass to the end
					else if (chunk.type === 'stmtlist') {
						this.tree = chunk;
					}
					cb(null);
				}
			}
		}
	};

	module.exports = GlslJsStream;

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	module.exports = Stream;

	var EE = __webpack_require__(3).EventEmitter;
	var inherits = __webpack_require__(4);

	inherits(Stream, EE);
	Stream.Readable = __webpack_require__(34);
	Stream.Writable = __webpack_require__(54);
	Stream.Duplex = __webpack_require__(55);
	Stream.Transform = __webpack_require__(56);
	Stream.PassThrough = __webpack_require__(57);

	// Backwards-compat with node 0.4.x
	Stream.Stream = Stream;



	// old-style streams.  Note that the pipe method (the only relevant
	// part of this class) is overridden in the Readable class.

	function Stream() {
	  EE.call(this);
	}

	Stream.prototype.pipe = function(dest, options) {
	  var source = this;

	  function ondata(chunk) {
	    if (dest.writable) {
	      if (false === dest.write(chunk) && source.pause) {
	        source.pause();
	      }
	    }
	  }

	  source.on('data', ondata);

	  function ondrain() {
	    if (source.readable && source.resume) {
	      source.resume();
	    }
	  }

	  dest.on('drain', ondrain);

	  // If the 'end' option is not supplied, dest.end() will be called when
	  // source gets the 'end' or 'close' events.  Only dest.end() once.
	  if (!dest._isStdio && (!options || options.end !== false)) {
	    source.on('end', onend);
	    source.on('close', onclose);
	  }

	  var didOnEnd = false;
	  function onend() {
	    if (didOnEnd) return;
	    didOnEnd = true;

	    dest.end();
	  }


	  function onclose() {
	    if (didOnEnd) return;
	    didOnEnd = true;

	    if (typeof dest.destroy === 'function') dest.destroy();
	  }

	  // don't leave dangling pipes when there are errors.
	  function onerror(er) {
	    cleanup();
	    if (EE.listenerCount(this, 'error') === 0) {
	      throw er; // Unhandled stream error in pipe.
	    }
	  }

	  source.on('error', onerror);
	  dest.on('error', onerror);

	  // remove all the event listeners that were added.
	  function cleanup() {
	    source.removeListener('data', ondata);
	    dest.removeListener('drain', ondrain);

	    source.removeListener('end', onend);
	    source.removeListener('close', onclose);

	    source.removeListener('error', onerror);
	    dest.removeListener('error', onerror);

	    source.removeListener('end', cleanup);
	    source.removeListener('close', cleanup);

	    dest.removeListener('close', cleanup);
	  }

	  source.on('end', cleanup);
	  source.on('close', cleanup);

	  dest.on('close', cleanup);

	  dest.emit('pipe', source);

	  // Allow for unix-like usage: A.pipe(B).pipe(C)
	  return dest;
	};


/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {var Stream = (function (){
	  try {
	    return __webpack_require__(33); // hack to fix a circular dependency issue when used with browserify
	  } catch(_){}
	}());
	exports = module.exports = __webpack_require__(35);
	exports.Stream = Stream || exports;
	exports.Readable = exports;
	exports.Writable = __webpack_require__(47);
	exports.Duplex = __webpack_require__(46);
	exports.Transform = __webpack_require__(52);
	exports.PassThrough = __webpack_require__(53);

	if (!process.browser && process.env.READABLE_STREAM === 'disable' && Stream) {
	  module.exports = Stream;
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(7)))

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';

	module.exports = Readable;

	/*<replacement>*/
	var processNextTick = __webpack_require__(36);
	/*</replacement>*/

	/*<replacement>*/
	var isArray = __webpack_require__(37);
	/*</replacement>*/

	/*<replacement>*/
	var Duplex;
	/*</replacement>*/

	Readable.ReadableState = ReadableState;

	/*<replacement>*/
	var EE = __webpack_require__(3).EventEmitter;

	var EElistenerCount = function (emitter, type) {
	  return emitter.listeners(type).length;
	};
	/*</replacement>*/

	/*<replacement>*/
	var Stream;
	(function () {
	  try {
	    Stream = __webpack_require__(33);
	  } catch (_) {} finally {
	    if (!Stream) Stream = __webpack_require__(3).EventEmitter;
	  }
	})();
	/*</replacement>*/

	var Buffer = __webpack_require__(38).Buffer;
	/*<replacement>*/
	var bufferShim = __webpack_require__(42);
	/*</replacement>*/

	/*<replacement>*/
	var util = __webpack_require__(43);
	util.inherits = __webpack_require__(4);
	/*</replacement>*/

	/*<replacement>*/
	var debugUtil = __webpack_require__(44);
	var debug = void 0;
	if (debugUtil && debugUtil.debuglog) {
	  debug = debugUtil.debuglog('stream');
	} else {
	  debug = function () {};
	}
	/*</replacement>*/

	var BufferList = __webpack_require__(45);
	var StringDecoder;

	util.inherits(Readable, Stream);

	function prependListener(emitter, event, fn) {
	  // Sadly this is not cacheable as some libraries bundle their own
	  // event emitter implementation with them.
	  if (typeof emitter.prependListener === 'function') {
	    return emitter.prependListener(event, fn);
	  } else {
	    // This is a hack to make sure that our error handler is attached before any
	    // userland ones.  NEVER DO THIS. This is here only because this code needs
	    // to continue to work with older versions of Node.js that do not include
	    // the prependListener() method. The goal is to eventually remove this hack.
	    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
	  }
	}

	function ReadableState(options, stream) {
	  Duplex = Duplex || __webpack_require__(46);

	  options = options || {};

	  // object stream flag. Used to make read(n) ignore n and to
	  // make all the buffer merging and length checks go away
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

	  // the point at which it stops calling _read() to fill the buffer
	  // Note: 0 is a valid value, means "don't call _read preemptively ever"
	  var hwm = options.highWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  // A linked list is used to store data chunks instead of an array because the
	  // linked list can remove elements from the beginning faster than
	  // array.shift()
	  this.buffer = new BufferList();
	  this.length = 0;
	  this.pipes = null;
	  this.pipesCount = 0;
	  this.flowing = null;
	  this.ended = false;
	  this.endEmitted = false;
	  this.reading = false;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // whenever we return null, then we set a flag to say
	  // that we're awaiting a 'readable' event emission.
	  this.needReadable = false;
	  this.emittedReadable = false;
	  this.readableListening = false;
	  this.resumeScheduled = false;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // when piping, we only care about 'readable' events that happen
	  // after read()ing all the bytes and not getting any pushback.
	  this.ranOut = false;

	  // the number of writers that are awaiting a drain event in .pipe()s
	  this.awaitDrain = 0;

	  // if true, a maybeReadMore has been scheduled
	  this.readingMore = false;

	  this.decoder = null;
	  this.encoding = null;
	  if (options.encoding) {
	    if (!StringDecoder) StringDecoder = __webpack_require__(51).StringDecoder;
	    this.decoder = new StringDecoder(options.encoding);
	    this.encoding = options.encoding;
	  }
	}

	function Readable(options) {
	  Duplex = Duplex || __webpack_require__(46);

	  if (!(this instanceof Readable)) return new Readable(options);

	  this._readableState = new ReadableState(options, this);

	  // legacy
	  this.readable = true;

	  if (options && typeof options.read === 'function') this._read = options.read;

	  Stream.call(this);
	}

	// Manually shove something into the read() buffer.
	// This returns true if the highWaterMark has not been hit yet,
	// similar to how Writable.write() returns true if you should
	// write() some more.
	Readable.prototype.push = function (chunk, encoding) {
	  var state = this._readableState;

	  if (!state.objectMode && typeof chunk === 'string') {
	    encoding = encoding || state.defaultEncoding;
	    if (encoding !== state.encoding) {
	      chunk = bufferShim.from(chunk, encoding);
	      encoding = '';
	    }
	  }

	  return readableAddChunk(this, state, chunk, encoding, false);
	};

	// Unshift should *always* be something directly out of read()
	Readable.prototype.unshift = function (chunk) {
	  var state = this._readableState;
	  return readableAddChunk(this, state, chunk, '', true);
	};

	Readable.prototype.isPaused = function () {
	  return this._readableState.flowing === false;
	};

	function readableAddChunk(stream, state, chunk, encoding, addToFront) {
	  var er = chunkInvalid(state, chunk);
	  if (er) {
	    stream.emit('error', er);
	  } else if (chunk === null) {
	    state.reading = false;
	    onEofChunk(stream, state);
	  } else if (state.objectMode || chunk && chunk.length > 0) {
	    if (state.ended && !addToFront) {
	      var e = new Error('stream.push() after EOF');
	      stream.emit('error', e);
	    } else if (state.endEmitted && addToFront) {
	      var _e = new Error('stream.unshift() after end event');
	      stream.emit('error', _e);
	    } else {
	      var skipAdd;
	      if (state.decoder && !addToFront && !encoding) {
	        chunk = state.decoder.write(chunk);
	        skipAdd = !state.objectMode && chunk.length === 0;
	      }

	      if (!addToFront) state.reading = false;

	      // Don't add to the buffer if we've decoded to an empty string chunk and
	      // we're not in object mode
	      if (!skipAdd) {
	        // if we want the data now, just emit it.
	        if (state.flowing && state.length === 0 && !state.sync) {
	          stream.emit('data', chunk);
	          stream.read(0);
	        } else {
	          // update the buffer info.
	          state.length += state.objectMode ? 1 : chunk.length;
	          if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

	          if (state.needReadable) emitReadable(stream);
	        }
	      }

	      maybeReadMore(stream, state);
	    }
	  } else if (!addToFront) {
	    state.reading = false;
	  }

	  return needMoreData(state);
	}

	// if it's past the high water mark, we can push in some more.
	// Also, if we have no data yet, we can stand some
	// more bytes.  This is to work around cases where hwm=0,
	// such as the repl.  Also, if the push() triggered a
	// readable event, and the user called read(largeNumber) such that
	// needReadable was set, then we ought to push more, so that another
	// 'readable' event will be triggered.
	function needMoreData(state) {
	  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
	}

	// backwards compatibility.
	Readable.prototype.setEncoding = function (enc) {
	  if (!StringDecoder) StringDecoder = __webpack_require__(51).StringDecoder;
	  this._readableState.decoder = new StringDecoder(enc);
	  this._readableState.encoding = enc;
	  return this;
	};

	// Don't raise the hwm > 8MB
	var MAX_HWM = 0x800000;
	function computeNewHighWaterMark(n) {
	  if (n >= MAX_HWM) {
	    n = MAX_HWM;
	  } else {
	    // Get the next highest power of 2 to prevent increasing hwm excessively in
	    // tiny amounts
	    n--;
	    n |= n >>> 1;
	    n |= n >>> 2;
	    n |= n >>> 4;
	    n |= n >>> 8;
	    n |= n >>> 16;
	    n++;
	  }
	  return n;
	}

	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function howMuchToRead(n, state) {
	  if (n <= 0 || state.length === 0 && state.ended) return 0;
	  if (state.objectMode) return 1;
	  if (n !== n) {
	    // Only flow one buffer at a time
	    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
	  }
	  // If we're asking for more than the current hwm, then raise the hwm.
	  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
	  if (n <= state.length) return n;
	  // Don't have enough
	  if (!state.ended) {
	    state.needReadable = true;
	    return 0;
	  }
	  return state.length;
	}

	// you can override either this method, or the async _read(n) below.
	Readable.prototype.read = function (n) {
	  debug('read', n);
	  n = parseInt(n, 10);
	  var state = this._readableState;
	  var nOrig = n;

	  if (n !== 0) state.emittedReadable = false;

	  // if we're doing read(0) to trigger a readable event, but we
	  // already have a bunch of data in the buffer, then just trigger
	  // the 'readable' event and move on.
	  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
	    debug('read: emitReadable', state.length, state.ended);
	    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
	    return null;
	  }

	  n = howMuchToRead(n, state);

	  // if we've ended, and we're now clear, then finish it up.
	  if (n === 0 && state.ended) {
	    if (state.length === 0) endReadable(this);
	    return null;
	  }

	  // All the actual chunk generation logic needs to be
	  // *below* the call to _read.  The reason is that in certain
	  // synthetic stream cases, such as passthrough streams, _read
	  // may be a completely synchronous operation which may change
	  // the state of the read buffer, providing enough data when
	  // before there was *not* enough.
	  //
	  // So, the steps are:
	  // 1. Figure out what the state of things will be after we do
	  // a read from the buffer.
	  //
	  // 2. If that resulting state will trigger a _read, then call _read.
	  // Note that this may be asynchronous, or synchronous.  Yes, it is
	  // deeply ugly to write APIs this way, but that still doesn't mean
	  // that the Readable class should behave improperly, as streams are
	  // designed to be sync/async agnostic.
	  // Take note if the _read call is sync or async (ie, if the read call
	  // has returned yet), so that we know whether or not it's safe to emit
	  // 'readable' etc.
	  //
	  // 3. Actually pull the requested chunks out of the buffer and return.

	  // if we need a readable event, then we need to do some reading.
	  var doRead = state.needReadable;
	  debug('need readable', doRead);

	  // if we currently have less than the highWaterMark, then also read some
	  if (state.length === 0 || state.length - n < state.highWaterMark) {
	    doRead = true;
	    debug('length less than watermark', doRead);
	  }

	  // however, if we've ended, then there's no point, and if we're already
	  // reading, then it's unnecessary.
	  if (state.ended || state.reading) {
	    doRead = false;
	    debug('reading or ended', doRead);
	  } else if (doRead) {
	    debug('do read');
	    state.reading = true;
	    state.sync = true;
	    // if the length is currently zero, then we *need* a readable event.
	    if (state.length === 0) state.needReadable = true;
	    // call internal read method
	    this._read(state.highWaterMark);
	    state.sync = false;
	    // If _read pushed data synchronously, then `reading` will be false,
	    // and we need to re-evaluate how much data we can return to the user.
	    if (!state.reading) n = howMuchToRead(nOrig, state);
	  }

	  var ret;
	  if (n > 0) ret = fromList(n, state);else ret = null;

	  if (ret === null) {
	    state.needReadable = true;
	    n = 0;
	  } else {
	    state.length -= n;
	  }

	  if (state.length === 0) {
	    // If we have nothing in the buffer, then we want to know
	    // as soon as we *do* get something into the buffer.
	    if (!state.ended) state.needReadable = true;

	    // If we tried to read() past the EOF, then emit end on the next tick.
	    if (nOrig !== n && state.ended) endReadable(this);
	  }

	  if (ret !== null) this.emit('data', ret);

	  return ret;
	};

	function chunkInvalid(state, chunk) {
	  var er = null;
	  if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  return er;
	}

	function onEofChunk(stream, state) {
	  if (state.ended) return;
	  if (state.decoder) {
	    var chunk = state.decoder.end();
	    if (chunk && chunk.length) {
	      state.buffer.push(chunk);
	      state.length += state.objectMode ? 1 : chunk.length;
	    }
	  }
	  state.ended = true;

	  // emit 'readable' now to make sure it gets picked up.
	  emitReadable(stream);
	}

	// Don't emit readable right away in sync mode, because this can trigger
	// another read() call => stack overflow.  This way, it might trigger
	// a nextTick recursion warning, but that's not so bad.
	function emitReadable(stream) {
	  var state = stream._readableState;
	  state.needReadable = false;
	  if (!state.emittedReadable) {
	    debug('emitReadable', state.flowing);
	    state.emittedReadable = true;
	    if (state.sync) processNextTick(emitReadable_, stream);else emitReadable_(stream);
	  }
	}

	function emitReadable_(stream) {
	  debug('emit readable');
	  stream.emit('readable');
	  flow(stream);
	}

	// at this point, the user has presumably seen the 'readable' event,
	// and called read() to consume some data.  that may have triggered
	// in turn another _read(n) call, in which case reading = true if
	// it's in progress.
	// However, if we're not ended, or reading, and the length < hwm,
	// then go ahead and try to read some more preemptively.
	function maybeReadMore(stream, state) {
	  if (!state.readingMore) {
	    state.readingMore = true;
	    processNextTick(maybeReadMore_, stream, state);
	  }
	}

	function maybeReadMore_(stream, state) {
	  var len = state.length;
	  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
	    debug('maybeReadMore read 0');
	    stream.read(0);
	    if (len === state.length)
	      // didn't get any data, stop spinning.
	      break;else len = state.length;
	  }
	  state.readingMore = false;
	}

	// abstract method.  to be overridden in specific implementation classes.
	// call cb(er, data) where data is <= n in length.
	// for virtual (non-string, non-buffer) streams, "length" is somewhat
	// arbitrary, and perhaps not very meaningful.
	Readable.prototype._read = function (n) {
	  this.emit('error', new Error('_read() is not implemented'));
	};

	Readable.prototype.pipe = function (dest, pipeOpts) {
	  var src = this;
	  var state = this._readableState;

	  switch (state.pipesCount) {
	    case 0:
	      state.pipes = dest;
	      break;
	    case 1:
	      state.pipes = [state.pipes, dest];
	      break;
	    default:
	      state.pipes.push(dest);
	      break;
	  }
	  state.pipesCount += 1;
	  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

	  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

	  var endFn = doEnd ? onend : cleanup;
	  if (state.endEmitted) processNextTick(endFn);else src.once('end', endFn);

	  dest.on('unpipe', onunpipe);
	  function onunpipe(readable) {
	    debug('onunpipe');
	    if (readable === src) {
	      cleanup();
	    }
	  }

	  function onend() {
	    debug('onend');
	    dest.end();
	  }

	  // when the dest drains, it reduces the awaitDrain counter
	  // on the source.  This would be more elegant with a .once()
	  // handler in flow(), but adding and removing repeatedly is
	  // too slow.
	  var ondrain = pipeOnDrain(src);
	  dest.on('drain', ondrain);

	  var cleanedUp = false;
	  function cleanup() {
	    debug('cleanup');
	    // cleanup event handlers once the pipe is broken
	    dest.removeListener('close', onclose);
	    dest.removeListener('finish', onfinish);
	    dest.removeListener('drain', ondrain);
	    dest.removeListener('error', onerror);
	    dest.removeListener('unpipe', onunpipe);
	    src.removeListener('end', onend);
	    src.removeListener('end', cleanup);
	    src.removeListener('data', ondata);

	    cleanedUp = true;

	    // if the reader is waiting for a drain event from this
	    // specific writer, then it would cause it to never start
	    // flowing again.
	    // So, if this is awaiting a drain, then we just call it now.
	    // If we don't know, then assume that we are waiting for one.
	    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
	  }

	  // If the user pushes more data while we're writing to dest then we'll end up
	  // in ondata again. However, we only want to increase awaitDrain once because
	  // dest will only emit one 'drain' event for the multiple writes.
	  // => Introduce a guard on increasing awaitDrain.
	  var increasedAwaitDrain = false;
	  src.on('data', ondata);
	  function ondata(chunk) {
	    debug('ondata');
	    increasedAwaitDrain = false;
	    var ret = dest.write(chunk);
	    if (false === ret && !increasedAwaitDrain) {
	      // If the user unpiped during `dest.write()`, it is possible
	      // to get stuck in a permanently paused state if that write
	      // also returned false.
	      // => Check whether `dest` is still a piping destination.
	      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
	        debug('false write response, pause', src._readableState.awaitDrain);
	        src._readableState.awaitDrain++;
	        increasedAwaitDrain = true;
	      }
	      src.pause();
	    }
	  }

	  // if the dest has an error, then stop piping into it.
	  // however, don't suppress the throwing behavior for this.
	  function onerror(er) {
	    debug('onerror', er);
	    unpipe();
	    dest.removeListener('error', onerror);
	    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
	  }

	  // Make sure our error handler is attached before userland ones.
	  prependListener(dest, 'error', onerror);

	  // Both close and finish should trigger unpipe, but only once.
	  function onclose() {
	    dest.removeListener('finish', onfinish);
	    unpipe();
	  }
	  dest.once('close', onclose);
	  function onfinish() {
	    debug('onfinish');
	    dest.removeListener('close', onclose);
	    unpipe();
	  }
	  dest.once('finish', onfinish);

	  function unpipe() {
	    debug('unpipe');
	    src.unpipe(dest);
	  }

	  // tell the dest that it's being piped to
	  dest.emit('pipe', src);

	  // start the flow if it hasn't been started already.
	  if (!state.flowing) {
	    debug('pipe resume');
	    src.resume();
	  }

	  return dest;
	};

	function pipeOnDrain(src) {
	  return function () {
	    var state = src._readableState;
	    debug('pipeOnDrain', state.awaitDrain);
	    if (state.awaitDrain) state.awaitDrain--;
	    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
	      state.flowing = true;
	      flow(src);
	    }
	  };
	}

	Readable.prototype.unpipe = function (dest) {
	  var state = this._readableState;

	  // if we're not piping anywhere, then do nothing.
	  if (state.pipesCount === 0) return this;

	  // just one destination.  most common case.
	  if (state.pipesCount === 1) {
	    // passed in one, but it's not the right one.
	    if (dest && dest !== state.pipes) return this;

	    if (!dest) dest = state.pipes;

	    // got a match.
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;
	    if (dest) dest.emit('unpipe', this);
	    return this;
	  }

	  // slow case. multiple pipe destinations.

	  if (!dest) {
	    // remove all.
	    var dests = state.pipes;
	    var len = state.pipesCount;
	    state.pipes = null;
	    state.pipesCount = 0;
	    state.flowing = false;

	    for (var i = 0; i < len; i++) {
	      dests[i].emit('unpipe', this);
	    }return this;
	  }

	  // try to find the right one.
	  var index = indexOf(state.pipes, dest);
	  if (index === -1) return this;

	  state.pipes.splice(index, 1);
	  state.pipesCount -= 1;
	  if (state.pipesCount === 1) state.pipes = state.pipes[0];

	  dest.emit('unpipe', this);

	  return this;
	};

	// set up data events if they are asked for
	// Ensure readable listeners eventually get something
	Readable.prototype.on = function (ev, fn) {
	  var res = Stream.prototype.on.call(this, ev, fn);

	  if (ev === 'data') {
	    // Start flowing on next tick if stream isn't explicitly paused
	    if (this._readableState.flowing !== false) this.resume();
	  } else if (ev === 'readable') {
	    var state = this._readableState;
	    if (!state.endEmitted && !state.readableListening) {
	      state.readableListening = state.needReadable = true;
	      state.emittedReadable = false;
	      if (!state.reading) {
	        processNextTick(nReadingNextTick, this);
	      } else if (state.length) {
	        emitReadable(this, state);
	      }
	    }
	  }

	  return res;
	};
	Readable.prototype.addListener = Readable.prototype.on;

	function nReadingNextTick(self) {
	  debug('readable nexttick read 0');
	  self.read(0);
	}

	// pause() and resume() are remnants of the legacy readable stream API
	// If the user uses them, then switch into old mode.
	Readable.prototype.resume = function () {
	  var state = this._readableState;
	  if (!state.flowing) {
	    debug('resume');
	    state.flowing = true;
	    resume(this, state);
	  }
	  return this;
	};

	function resume(stream, state) {
	  if (!state.resumeScheduled) {
	    state.resumeScheduled = true;
	    processNextTick(resume_, stream, state);
	  }
	}

	function resume_(stream, state) {
	  if (!state.reading) {
	    debug('resume read 0');
	    stream.read(0);
	  }

	  state.resumeScheduled = false;
	  state.awaitDrain = 0;
	  stream.emit('resume');
	  flow(stream);
	  if (state.flowing && !state.reading) stream.read(0);
	}

	Readable.prototype.pause = function () {
	  debug('call pause flowing=%j', this._readableState.flowing);
	  if (false !== this._readableState.flowing) {
	    debug('pause');
	    this._readableState.flowing = false;
	    this.emit('pause');
	  }
	  return this;
	};

	function flow(stream) {
	  var state = stream._readableState;
	  debug('flow', state.flowing);
	  while (state.flowing && stream.read() !== null) {}
	}

	// wrap an old-style stream as the async data source.
	// This is *not* part of the readable stream interface.
	// It is an ugly unfortunate mess of history.
	Readable.prototype.wrap = function (stream) {
	  var state = this._readableState;
	  var paused = false;

	  var self = this;
	  stream.on('end', function () {
	    debug('wrapped end');
	    if (state.decoder && !state.ended) {
	      var chunk = state.decoder.end();
	      if (chunk && chunk.length) self.push(chunk);
	    }

	    self.push(null);
	  });

	  stream.on('data', function (chunk) {
	    debug('wrapped data');
	    if (state.decoder) chunk = state.decoder.write(chunk);

	    // don't skip over falsy values in objectMode
	    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

	    var ret = self.push(chunk);
	    if (!ret) {
	      paused = true;
	      stream.pause();
	    }
	  });

	  // proxy all the other methods.
	  // important when wrapping filters and duplexes.
	  for (var i in stream) {
	    if (this[i] === undefined && typeof stream[i] === 'function') {
	      this[i] = function (method) {
	        return function () {
	          return stream[method].apply(stream, arguments);
	        };
	      }(i);
	    }
	  }

	  // proxy certain important events.
	  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
	  forEach(events, function (ev) {
	    stream.on(ev, self.emit.bind(self, ev));
	  });

	  // when we try to consume some more bytes, simply unpause the
	  // underlying stream.
	  self._read = function (n) {
	    debug('wrapped _read', n);
	    if (paused) {
	      paused = false;
	      stream.resume();
	    }
	  };

	  return self;
	};

	// exposed for testing purposes only.
	Readable._fromList = fromList;

	// Pluck off n bytes from an array of buffers.
	// Length is the combined lengths of all the buffers in the list.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function fromList(n, state) {
	  // nothing buffered
	  if (state.length === 0) return null;

	  var ret;
	  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
	    // read it all, truncate the list
	    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
	    state.buffer.clear();
	  } else {
	    // read part of list
	    ret = fromListPartial(n, state.buffer, state.decoder);
	  }

	  return ret;
	}

	// Extracts only enough buffered data to satisfy the amount requested.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function fromListPartial(n, list, hasStrings) {
	  var ret;
	  if (n < list.head.data.length) {
	    // slice is the same for buffers and strings
	    ret = list.head.data.slice(0, n);
	    list.head.data = list.head.data.slice(n);
	  } else if (n === list.head.data.length) {
	    // first chunk is a perfect match
	    ret = list.shift();
	  } else {
	    // result spans more than one buffer
	    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
	  }
	  return ret;
	}

	// Copies a specified amount of characters from the list of buffered data
	// chunks.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function copyFromBufferString(n, list) {
	  var p = list.head;
	  var c = 1;
	  var ret = p.data;
	  n -= ret.length;
	  while (p = p.next) {
	    var str = p.data;
	    var nb = n > str.length ? str.length : n;
	    if (nb === str.length) ret += str;else ret += str.slice(0, n);
	    n -= nb;
	    if (n === 0) {
	      if (nb === str.length) {
	        ++c;
	        if (p.next) list.head = p.next;else list.head = list.tail = null;
	      } else {
	        list.head = p;
	        p.data = str.slice(nb);
	      }
	      break;
	    }
	    ++c;
	  }
	  list.length -= c;
	  return ret;
	}

	// Copies a specified amount of bytes from the list of buffered data chunks.
	// This function is designed to be inlinable, so please take care when making
	// changes to the function body.
	function copyFromBuffer(n, list) {
	  var ret = bufferShim.allocUnsafe(n);
	  var p = list.head;
	  var c = 1;
	  p.data.copy(ret);
	  n -= p.data.length;
	  while (p = p.next) {
	    var buf = p.data;
	    var nb = n > buf.length ? buf.length : n;
	    buf.copy(ret, ret.length - n, 0, nb);
	    n -= nb;
	    if (n === 0) {
	      if (nb === buf.length) {
	        ++c;
	        if (p.next) list.head = p.next;else list.head = list.tail = null;
	      } else {
	        list.head = p;
	        p.data = buf.slice(nb);
	      }
	      break;
	    }
	    ++c;
	  }
	  list.length -= c;
	  return ret;
	}

	function endReadable(stream) {
	  var state = stream._readableState;

	  // If we get here before consuming all the bytes, then that is a
	  // bug in node.  Should never happen.
	  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

	  if (!state.endEmitted) {
	    state.ended = true;
	    processNextTick(endReadableNT, state, stream);
	  }
	}

	function endReadableNT(state, stream) {
	  // Check that we didn't get one last unshift.
	  if (!state.endEmitted && state.length === 0) {
	    state.endEmitted = true;
	    stream.readable = false;
	    stream.emit('end');
	  }
	}

	function forEach(xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}

	function indexOf(xs, x) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    if (xs[i] === x) return i;
	  }
	  return -1;
	}
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(7)))

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';

	if (!process.version ||
	    process.version.indexOf('v0.') === 0 ||
	    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
	  module.exports = nextTick;
	} else {
	  module.exports = process.nextTick;
	}

	function nextTick(fn, arg1, arg2, arg3) {
	  if (typeof fn !== 'function') {
	    throw new TypeError('"callback" argument must be a function');
	  }
	  var len = arguments.length;
	  var args, i;
	  switch (len) {
	  case 0:
	  case 1:
	    return process.nextTick(fn);
	  case 2:
	    return process.nextTick(function afterTickOne() {
	      fn.call(null, arg1);
	    });
	  case 3:
	    return process.nextTick(function afterTickTwo() {
	      fn.call(null, arg1, arg2);
	    });
	  case 4:
	    return process.nextTick(function afterTickThree() {
	      fn.call(null, arg1, arg2, arg3);
	    });
	  default:
	    args = new Array(len - 1);
	    i = 0;
	    while (i < args.length) {
	      args[i++] = arguments[i];
	    }
	    return process.nextTick(function afterTick() {
	      fn.apply(null, args);
	    });
	  }
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(7)))

/***/ },
/* 37 */
/***/ function(module, exports) {

	var toString = {}.toString;

	module.exports = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};


/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/*!
	 * The buffer module from node.js, for the browser.
	 *
	 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
	 * @license  MIT
	 */
	/* eslint-disable no-proto */

	'use strict'

	var base64 = __webpack_require__(39)
	var ieee754 = __webpack_require__(40)
	var isArray = __webpack_require__(41)

	exports.Buffer = Buffer
	exports.SlowBuffer = SlowBuffer
	exports.INSPECT_MAX_BYTES = 50

	/**
	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
	 *   === true    Use Uint8Array implementation (fastest)
	 *   === false   Use Object implementation (most compatible, even IE6)
	 *
	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
	 * Opera 11.6+, iOS 4.2+.
	 *
	 * Due to various browser bugs, sometimes the Object implementation will be used even
	 * when the browser supports typed arrays.
	 *
	 * Note:
	 *
	 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
	 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
	 *
	 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
	 *
	 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
	 *     incorrect length in some situations.

	 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
	 * get the Object implementation, which is slower but behaves correctly.
	 */
	Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
	  ? global.TYPED_ARRAY_SUPPORT
	  : typedArraySupport()

	/*
	 * Export kMaxLength after typed array support is determined.
	 */
	exports.kMaxLength = kMaxLength()

	function typedArraySupport () {
	  try {
	    var arr = new Uint8Array(1)
	    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
	    return arr.foo() === 42 && // typed array instances can be augmented
	        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
	        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
	  } catch (e) {
	    return false
	  }
	}

	function kMaxLength () {
	  return Buffer.TYPED_ARRAY_SUPPORT
	    ? 0x7fffffff
	    : 0x3fffffff
	}

	function createBuffer (that, length) {
	  if (kMaxLength() < length) {
	    throw new RangeError('Invalid typed array length')
	  }
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = new Uint8Array(length)
	    that.__proto__ = Buffer.prototype
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    if (that === null) {
	      that = new Buffer(length)
	    }
	    that.length = length
	  }

	  return that
	}

	/**
	 * The Buffer constructor returns instances of `Uint8Array` that have their
	 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
	 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
	 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
	 * returns a single octet.
	 *
	 * The `Uint8Array` prototype remains unmodified.
	 */

	function Buffer (arg, encodingOrOffset, length) {
	  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
	    return new Buffer(arg, encodingOrOffset, length)
	  }

	  // Common case.
	  if (typeof arg === 'number') {
	    if (typeof encodingOrOffset === 'string') {
	      throw new Error(
	        'If encoding is specified then the first argument must be a string'
	      )
	    }
	    return allocUnsafe(this, arg)
	  }
	  return from(this, arg, encodingOrOffset, length)
	}

	Buffer.poolSize = 8192 // not used by this implementation

	// TODO: Legacy, not needed anymore. Remove in next major version.
	Buffer._augment = function (arr) {
	  arr.__proto__ = Buffer.prototype
	  return arr
	}

	function from (that, value, encodingOrOffset, length) {
	  if (typeof value === 'number') {
	    throw new TypeError('"value" argument must not be a number')
	  }

	  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
	    return fromArrayBuffer(that, value, encodingOrOffset, length)
	  }

	  if (typeof value === 'string') {
	    return fromString(that, value, encodingOrOffset)
	  }

	  return fromObject(that, value)
	}

	/**
	 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
	 * if value is a number.
	 * Buffer.from(str[, encoding])
	 * Buffer.from(array)
	 * Buffer.from(buffer)
	 * Buffer.from(arrayBuffer[, byteOffset[, length]])
	 **/
	Buffer.from = function (value, encodingOrOffset, length) {
	  return from(null, value, encodingOrOffset, length)
	}

	if (Buffer.TYPED_ARRAY_SUPPORT) {
	  Buffer.prototype.__proto__ = Uint8Array.prototype
	  Buffer.__proto__ = Uint8Array
	  if (typeof Symbol !== 'undefined' && Symbol.species &&
	      Buffer[Symbol.species] === Buffer) {
	    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
	    Object.defineProperty(Buffer, Symbol.species, {
	      value: null,
	      configurable: true
	    })
	  }
	}

	function assertSize (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('"size" argument must be a number')
	  } else if (size < 0) {
	    throw new RangeError('"size" argument must not be negative')
	  }
	}

	function alloc (that, size, fill, encoding) {
	  assertSize(size)
	  if (size <= 0) {
	    return createBuffer(that, size)
	  }
	  if (fill !== undefined) {
	    // Only pay attention to encoding if it's a string. This
	    // prevents accidentally sending in a number that would
	    // be interpretted as a start offset.
	    return typeof encoding === 'string'
	      ? createBuffer(that, size).fill(fill, encoding)
	      : createBuffer(that, size).fill(fill)
	  }
	  return createBuffer(that, size)
	}

	/**
	 * Creates a new filled Buffer instance.
	 * alloc(size[, fill[, encoding]])
	 **/
	Buffer.alloc = function (size, fill, encoding) {
	  return alloc(null, size, fill, encoding)
	}

	function allocUnsafe (that, size) {
	  assertSize(size)
	  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) {
	    for (var i = 0; i < size; ++i) {
	      that[i] = 0
	    }
	  }
	  return that
	}

	/**
	 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
	 * */
	Buffer.allocUnsafe = function (size) {
	  return allocUnsafe(null, size)
	}
	/**
	 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
	 */
	Buffer.allocUnsafeSlow = function (size) {
	  return allocUnsafe(null, size)
	}

	function fromString (that, string, encoding) {
	  if (typeof encoding !== 'string' || encoding === '') {
	    encoding = 'utf8'
	  }

	  if (!Buffer.isEncoding(encoding)) {
	    throw new TypeError('"encoding" must be a valid string encoding')
	  }

	  var length = byteLength(string, encoding) | 0
	  that = createBuffer(that, length)

	  var actual = that.write(string, encoding)

	  if (actual !== length) {
	    // Writing a hex string, for example, that contains invalid characters will
	    // cause everything after the first invalid character to be ignored. (e.g.
	    // 'abxxcd' will be treated as 'ab')
	    that = that.slice(0, actual)
	  }

	  return that
	}

	function fromArrayLike (that, array) {
	  var length = array.length < 0 ? 0 : checked(array.length) | 0
	  that = createBuffer(that, length)
	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255
	  }
	  return that
	}

	function fromArrayBuffer (that, array, byteOffset, length) {
	  array.byteLength // this throws if `array` is not a valid ArrayBuffer

	  if (byteOffset < 0 || array.byteLength < byteOffset) {
	    throw new RangeError('\'offset\' is out of bounds')
	  }

	  if (array.byteLength < byteOffset + (length || 0)) {
	    throw new RangeError('\'length\' is out of bounds')
	  }

	  if (byteOffset === undefined && length === undefined) {
	    array = new Uint8Array(array)
	  } else if (length === undefined) {
	    array = new Uint8Array(array, byteOffset)
	  } else {
	    array = new Uint8Array(array, byteOffset, length)
	  }

	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = array
	    that.__proto__ = Buffer.prototype
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    that = fromArrayLike(that, array)
	  }
	  return that
	}

	function fromObject (that, obj) {
	  if (Buffer.isBuffer(obj)) {
	    var len = checked(obj.length) | 0
	    that = createBuffer(that, len)

	    if (that.length === 0) {
	      return that
	    }

	    obj.copy(that, 0, 0, len)
	    return that
	  }

	  if (obj) {
	    if ((typeof ArrayBuffer !== 'undefined' &&
	        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
	      if (typeof obj.length !== 'number' || isnan(obj.length)) {
	        return createBuffer(that, 0)
	      }
	      return fromArrayLike(that, obj)
	    }

	    if (obj.type === 'Buffer' && isArray(obj.data)) {
	      return fromArrayLike(that, obj.data)
	    }
	  }

	  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
	}

	function checked (length) {
	  // Note: cannot use `length < kMaxLength()` here because that fails when
	  // length is NaN (which is otherwise coerced to zero.)
	  if (length >= kMaxLength()) {
	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
	                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
	  }
	  return length | 0
	}

	function SlowBuffer (length) {
	  if (+length != length) { // eslint-disable-line eqeqeq
	    length = 0
	  }
	  return Buffer.alloc(+length)
	}

	Buffer.isBuffer = function isBuffer (b) {
	  return !!(b != null && b._isBuffer)
	}

	Buffer.compare = function compare (a, b) {
	  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
	    throw new TypeError('Arguments must be Buffers')
	  }

	  if (a === b) return 0

	  var x = a.length
	  var y = b.length

	  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
	    if (a[i] !== b[i]) {
	      x = a[i]
	      y = b[i]
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	}

	Buffer.isEncoding = function isEncoding (encoding) {
	  switch (String(encoding).toLowerCase()) {
	    case 'hex':
	    case 'utf8':
	    case 'utf-8':
	    case 'ascii':
	    case 'latin1':
	    case 'binary':
	    case 'base64':
	    case 'ucs2':
	    case 'ucs-2':
	    case 'utf16le':
	    case 'utf-16le':
	      return true
	    default:
	      return false
	  }
	}

	Buffer.concat = function concat (list, length) {
	  if (!isArray(list)) {
	    throw new TypeError('"list" argument must be an Array of Buffers')
	  }

	  if (list.length === 0) {
	    return Buffer.alloc(0)
	  }

	  var i
	  if (length === undefined) {
	    length = 0
	    for (i = 0; i < list.length; ++i) {
	      length += list[i].length
	    }
	  }

	  var buffer = Buffer.allocUnsafe(length)
	  var pos = 0
	  for (i = 0; i < list.length; ++i) {
	    var buf = list[i]
	    if (!Buffer.isBuffer(buf)) {
	      throw new TypeError('"list" argument must be an Array of Buffers')
	    }
	    buf.copy(buffer, pos)
	    pos += buf.length
	  }
	  return buffer
	}

	function byteLength (string, encoding) {
	  if (Buffer.isBuffer(string)) {
	    return string.length
	  }
	  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
	      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
	    return string.byteLength
	  }
	  if (typeof string !== 'string') {
	    string = '' + string
	  }

	  var len = string.length
	  if (len === 0) return 0

	  // Use a for loop to avoid recursion
	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'ascii':
	      case 'latin1':
	      case 'binary':
	        return len
	      case 'utf8':
	      case 'utf-8':
	      case undefined:
	        return utf8ToBytes(string).length
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return len * 2
	      case 'hex':
	        return len >>> 1
	      case 'base64':
	        return base64ToBytes(string).length
	      default:
	        if (loweredCase) return utf8ToBytes(string).length // assume utf8
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}
	Buffer.byteLength = byteLength

	function slowToString (encoding, start, end) {
	  var loweredCase = false

	  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
	  // property of a typed array.

	  // This behaves neither like String nor Uint8Array in that we set start/end
	  // to their upper/lower bounds if the value passed is out of range.
	  // undefined is handled specially as per ECMA-262 6th Edition,
	  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
	  if (start === undefined || start < 0) {
	    start = 0
	  }
	  // Return early if start > this.length. Done here to prevent potential uint32
	  // coercion fail below.
	  if (start > this.length) {
	    return ''
	  }

	  if (end === undefined || end > this.length) {
	    end = this.length
	  }

	  if (end <= 0) {
	    return ''
	  }

	  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
	  end >>>= 0
	  start >>>= 0

	  if (end <= start) {
	    return ''
	  }

	  if (!encoding) encoding = 'utf8'

	  while (true) {
	    switch (encoding) {
	      case 'hex':
	        return hexSlice(this, start, end)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Slice(this, start, end)

	      case 'ascii':
	        return asciiSlice(this, start, end)

	      case 'latin1':
	      case 'binary':
	        return latin1Slice(this, start, end)

	      case 'base64':
	        return base64Slice(this, start, end)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return utf16leSlice(this, start, end)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = (encoding + '').toLowerCase()
	        loweredCase = true
	    }
	  }
	}

	// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
	// Buffer instances.
	Buffer.prototype._isBuffer = true

	function swap (b, n, m) {
	  var i = b[n]
	  b[n] = b[m]
	  b[m] = i
	}

	Buffer.prototype.swap16 = function swap16 () {
	  var len = this.length
	  if (len % 2 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 16-bits')
	  }
	  for (var i = 0; i < len; i += 2) {
	    swap(this, i, i + 1)
	  }
	  return this
	}

	Buffer.prototype.swap32 = function swap32 () {
	  var len = this.length
	  if (len % 4 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 32-bits')
	  }
	  for (var i = 0; i < len; i += 4) {
	    swap(this, i, i + 3)
	    swap(this, i + 1, i + 2)
	  }
	  return this
	}

	Buffer.prototype.swap64 = function swap64 () {
	  var len = this.length
	  if (len % 8 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 64-bits')
	  }
	  for (var i = 0; i < len; i += 8) {
	    swap(this, i, i + 7)
	    swap(this, i + 1, i + 6)
	    swap(this, i + 2, i + 5)
	    swap(this, i + 3, i + 4)
	  }
	  return this
	}

	Buffer.prototype.toString = function toString () {
	  var length = this.length | 0
	  if (length === 0) return ''
	  if (arguments.length === 0) return utf8Slice(this, 0, length)
	  return slowToString.apply(this, arguments)
	}

	Buffer.prototype.equals = function equals (b) {
	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
	  if (this === b) return true
	  return Buffer.compare(this, b) === 0
	}

	Buffer.prototype.inspect = function inspect () {
	  var str = ''
	  var max = exports.INSPECT_MAX_BYTES
	  if (this.length > 0) {
	    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
	    if (this.length > max) str += ' ... '
	  }
	  return '<Buffer ' + str + '>'
	}

	Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
	  if (!Buffer.isBuffer(target)) {
	    throw new TypeError('Argument must be a Buffer')
	  }

	  if (start === undefined) {
	    start = 0
	  }
	  if (end === undefined) {
	    end = target ? target.length : 0
	  }
	  if (thisStart === undefined) {
	    thisStart = 0
	  }
	  if (thisEnd === undefined) {
	    thisEnd = this.length
	  }

	  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
	    throw new RangeError('out of range index')
	  }

	  if (thisStart >= thisEnd && start >= end) {
	    return 0
	  }
	  if (thisStart >= thisEnd) {
	    return -1
	  }
	  if (start >= end) {
	    return 1
	  }

	  start >>>= 0
	  end >>>= 0
	  thisStart >>>= 0
	  thisEnd >>>= 0

	  if (this === target) return 0

	  var x = thisEnd - thisStart
	  var y = end - start
	  var len = Math.min(x, y)

	  var thisCopy = this.slice(thisStart, thisEnd)
	  var targetCopy = target.slice(start, end)

	  for (var i = 0; i < len; ++i) {
	    if (thisCopy[i] !== targetCopy[i]) {
	      x = thisCopy[i]
	      y = targetCopy[i]
	      break
	    }
	  }

	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	}

	// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
	// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
	//
	// Arguments:
	// - buffer - a Buffer to search
	// - val - a string, Buffer, or number
	// - byteOffset - an index into `buffer`; will be clamped to an int32
	// - encoding - an optional encoding, relevant is val is a string
	// - dir - true for indexOf, false for lastIndexOf
	function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
	  // Empty buffer means no match
	  if (buffer.length === 0) return -1

	  // Normalize byteOffset
	  if (typeof byteOffset === 'string') {
	    encoding = byteOffset
	    byteOffset = 0
	  } else if (byteOffset > 0x7fffffff) {
	    byteOffset = 0x7fffffff
	  } else if (byteOffset < -0x80000000) {
	    byteOffset = -0x80000000
	  }
	  byteOffset = +byteOffset  // Coerce to Number.
	  if (isNaN(byteOffset)) {
	    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
	    byteOffset = dir ? 0 : (buffer.length - 1)
	  }

	  // Normalize byteOffset: negative offsets start from the end of the buffer
	  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
	  if (byteOffset >= buffer.length) {
	    if (dir) return -1
	    else byteOffset = buffer.length - 1
	  } else if (byteOffset < 0) {
	    if (dir) byteOffset = 0
	    else return -1
	  }

	  // Normalize val
	  if (typeof val === 'string') {
	    val = Buffer.from(val, encoding)
	  }

	  // Finally, search either indexOf (if dir is true) or lastIndexOf
	  if (Buffer.isBuffer(val)) {
	    // Special case: looking for empty string/buffer always fails
	    if (val.length === 0) {
	      return -1
	    }
	    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
	  } else if (typeof val === 'number') {
	    val = val & 0xFF // Search for a byte value [0-255]
	    if (Buffer.TYPED_ARRAY_SUPPORT &&
	        typeof Uint8Array.prototype.indexOf === 'function') {
	      if (dir) {
	        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
	      } else {
	        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
	      }
	    }
	    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
	  }

	  throw new TypeError('val must be string, number or Buffer')
	}

	function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
	  var indexSize = 1
	  var arrLength = arr.length
	  var valLength = val.length

	  if (encoding !== undefined) {
	    encoding = String(encoding).toLowerCase()
	    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
	        encoding === 'utf16le' || encoding === 'utf-16le') {
	      if (arr.length < 2 || val.length < 2) {
	        return -1
	      }
	      indexSize = 2
	      arrLength /= 2
	      valLength /= 2
	      byteOffset /= 2
	    }
	  }

	  function read (buf, i) {
	    if (indexSize === 1) {
	      return buf[i]
	    } else {
	      return buf.readUInt16BE(i * indexSize)
	    }
	  }

	  var i
	  if (dir) {
	    var foundIndex = -1
	    for (i = byteOffset; i < arrLength; i++) {
	      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
	        if (foundIndex === -1) foundIndex = i
	        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
	      } else {
	        if (foundIndex !== -1) i -= i - foundIndex
	        foundIndex = -1
	      }
	    }
	  } else {
	    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
	    for (i = byteOffset; i >= 0; i--) {
	      var found = true
	      for (var j = 0; j < valLength; j++) {
	        if (read(arr, i + j) !== read(val, j)) {
	          found = false
	          break
	        }
	      }
	      if (found) return i
	    }
	  }

	  return -1
	}

	Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
	  return this.indexOf(val, byteOffset, encoding) !== -1
	}

	Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
	}

	Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
	}

	function hexWrite (buf, string, offset, length) {
	  offset = Number(offset) || 0
	  var remaining = buf.length - offset
	  if (!length) {
	    length = remaining
	  } else {
	    length = Number(length)
	    if (length > remaining) {
	      length = remaining
	    }
	  }

	  // must be an even number of digits
	  var strLen = string.length
	  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

	  if (length > strLen / 2) {
	    length = strLen / 2
	  }
	  for (var i = 0; i < length; ++i) {
	    var parsed = parseInt(string.substr(i * 2, 2), 16)
	    if (isNaN(parsed)) return i
	    buf[offset + i] = parsed
	  }
	  return i
	}

	function utf8Write (buf, string, offset, length) {
	  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
	}

	function asciiWrite (buf, string, offset, length) {
	  return blitBuffer(asciiToBytes(string), buf, offset, length)
	}

	function latin1Write (buf, string, offset, length) {
	  return asciiWrite(buf, string, offset, length)
	}

	function base64Write (buf, string, offset, length) {
	  return blitBuffer(base64ToBytes(string), buf, offset, length)
	}

	function ucs2Write (buf, string, offset, length) {
	  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
	}

	Buffer.prototype.write = function write (string, offset, length, encoding) {
	  // Buffer#write(string)
	  if (offset === undefined) {
	    encoding = 'utf8'
	    length = this.length
	    offset = 0
	  // Buffer#write(string, encoding)
	  } else if (length === undefined && typeof offset === 'string') {
	    encoding = offset
	    length = this.length
	    offset = 0
	  // Buffer#write(string, offset[, length][, encoding])
	  } else if (isFinite(offset)) {
	    offset = offset | 0
	    if (isFinite(length)) {
	      length = length | 0
	      if (encoding === undefined) encoding = 'utf8'
	    } else {
	      encoding = length
	      length = undefined
	    }
	  // legacy write(string, encoding, offset, length) - remove in v0.13
	  } else {
	    throw new Error(
	      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
	    )
	  }

	  var remaining = this.length - offset
	  if (length === undefined || length > remaining) length = remaining

	  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
	    throw new RangeError('Attempt to write outside buffer bounds')
	  }

	  if (!encoding) encoding = 'utf8'

	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'hex':
	        return hexWrite(this, string, offset, length)

	      case 'utf8':
	      case 'utf-8':
	        return utf8Write(this, string, offset, length)

	      case 'ascii':
	        return asciiWrite(this, string, offset, length)

	      case 'latin1':
	      case 'binary':
	        return latin1Write(this, string, offset, length)

	      case 'base64':
	        // Warning: maxLength not taken into account in base64Write
	        return base64Write(this, string, offset, length)

	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return ucs2Write(this, string, offset, length)

	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}

	Buffer.prototype.toJSON = function toJSON () {
	  return {
	    type: 'Buffer',
	    data: Array.prototype.slice.call(this._arr || this, 0)
	  }
	}

	function base64Slice (buf, start, end) {
	  if (start === 0 && end === buf.length) {
	    return base64.fromByteArray(buf)
	  } else {
	    return base64.fromByteArray(buf.slice(start, end))
	  }
	}

	function utf8Slice (buf, start, end) {
	  end = Math.min(buf.length, end)
	  var res = []

	  var i = start
	  while (i < end) {
	    var firstByte = buf[i]
	    var codePoint = null
	    var bytesPerSequence = (firstByte > 0xEF) ? 4
	      : (firstByte > 0xDF) ? 3
	      : (firstByte > 0xBF) ? 2
	      : 1

	    if (i + bytesPerSequence <= end) {
	      var secondByte, thirdByte, fourthByte, tempCodePoint

	      switch (bytesPerSequence) {
	        case 1:
	          if (firstByte < 0x80) {
	            codePoint = firstByte
	          }
	          break
	        case 2:
	          secondByte = buf[i + 1]
	          if ((secondByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
	            if (tempCodePoint > 0x7F) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 3:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
	            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 4:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          fourthByte = buf[i + 3]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
	            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
	              codePoint = tempCodePoint
	            }
	          }
	      }
	    }

	    if (codePoint === null) {
	      // we did not generate a valid codePoint so insert a
	      // replacement char (U+FFFD) and advance only 1 byte
	      codePoint = 0xFFFD
	      bytesPerSequence = 1
	    } else if (codePoint > 0xFFFF) {
	      // encode to utf16 (surrogate pair dance)
	      codePoint -= 0x10000
	      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
	      codePoint = 0xDC00 | codePoint & 0x3FF
	    }

	    res.push(codePoint)
	    i += bytesPerSequence
	  }

	  return decodeCodePointsArray(res)
	}

	// Based on http://stackoverflow.com/a/22747272/680742, the browser with
	// the lowest limit is Chrome, with 0x10000 args.
	// We go 1 magnitude less, for safety
	var MAX_ARGUMENTS_LENGTH = 0x1000

	function decodeCodePointsArray (codePoints) {
	  var len = codePoints.length
	  if (len <= MAX_ARGUMENTS_LENGTH) {
	    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
	  }

	  // Decode in chunks to avoid "call stack size exceeded".
	  var res = ''
	  var i = 0
	  while (i < len) {
	    res += String.fromCharCode.apply(
	      String,
	      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
	    )
	  }
	  return res
	}

	function asciiSlice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i] & 0x7F)
	  }
	  return ret
	}

	function latin1Slice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)

	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i])
	  }
	  return ret
	}

	function hexSlice (buf, start, end) {
	  var len = buf.length

	  if (!start || start < 0) start = 0
	  if (!end || end < 0 || end > len) end = len

	  var out = ''
	  for (var i = start; i < end; ++i) {
	    out += toHex(buf[i])
	  }
	  return out
	}

	function utf16leSlice (buf, start, end) {
	  var bytes = buf.slice(start, end)
	  var res = ''
	  for (var i = 0; i < bytes.length; i += 2) {
	    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
	  }
	  return res
	}

	Buffer.prototype.slice = function slice (start, end) {
	  var len = this.length
	  start = ~~start
	  end = end === undefined ? len : ~~end

	  if (start < 0) {
	    start += len
	    if (start < 0) start = 0
	  } else if (start > len) {
	    start = len
	  }

	  if (end < 0) {
	    end += len
	    if (end < 0) end = 0
	  } else if (end > len) {
	    end = len
	  }

	  if (end < start) end = start

	  var newBuf
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    newBuf = this.subarray(start, end)
	    newBuf.__proto__ = Buffer.prototype
	  } else {
	    var sliceLen = end - start
	    newBuf = new Buffer(sliceLen, undefined)
	    for (var i = 0; i < sliceLen; ++i) {
	      newBuf[i] = this[i + start]
	    }
	  }

	  return newBuf
	}

	/*
	 * Need to make sure that buffer isn't trying to write out of bounds.
	 */
	function checkOffset (offset, ext, length) {
	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
	}

	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }

	  return val
	}

	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    checkOffset(offset, byteLength, this.length)
	  }

	  var val = this[offset + --byteLength]
	  var mul = 1
	  while (byteLength > 0 && (mul *= 0x100)) {
	    val += this[offset + --byteLength] * mul
	  }

	  return val
	}

	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  return this[offset]
	}

	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return this[offset] | (this[offset + 1] << 8)
	}

	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return (this[offset] << 8) | this[offset + 1]
	}

	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return ((this[offset]) |
	      (this[offset + 1] << 8) |
	      (this[offset + 2] << 16)) +
	      (this[offset + 3] * 0x1000000)
	}

	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset] * 0x1000000) +
	    ((this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    this[offset + 3])
	}

	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }
	  mul *= 0x80

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

	  return val
	}

	Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)

	  var i = byteLength
	  var mul = 1
	  var val = this[offset + --i]
	  while (i > 0 && (mul *= 0x100)) {
	    val += this[offset + --i] * mul
	  }
	  mul *= 0x80

	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

	  return val
	}

	Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  if (!(this[offset] & 0x80)) return (this[offset])
	  return ((0xff - this[offset] + 1) * -1)
	}

	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset] | (this[offset + 1] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}

	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset + 1] | (this[offset] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}

	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset]) |
	    (this[offset + 1] << 8) |
	    (this[offset + 2] << 16) |
	    (this[offset + 3] << 24)
	}

	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)

	  return (this[offset] << 24) |
	    (this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    (this[offset + 3])
	}

	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, true, 23, 4)
	}

	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, false, 23, 4)
	}

	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, true, 52, 8)
	}

	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, false, 52, 8)
	}

	function checkInt (buf, value, offset, ext, max, min) {
	  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
	  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	}

	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1
	    checkInt(this, value, offset, byteLength, maxBytes, 0)
	  }

	  var mul = 1
	  var i = 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1
	    checkInt(this, value, offset, byteLength, maxBytes, 0)
	  }

	  var i = byteLength - 1
	  var mul = 1
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  this[offset] = (value & 0xff)
	  return offset + 1
	}

	function objectWriteUInt16 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
	    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
	      (littleEndian ? i : 1 - i) * 8
	  }
	}

	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = (value & 0xff)
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}

	function objectWriteUInt32 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffffffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
	    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
	  }
	}

	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset + 3] = (value >>> 24)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 1] = (value >>> 8)
	    this[offset] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)

	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }

	  var i = 0
	  var mul = 1
	  var sub = 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
	      sub = 1
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)

	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }

	  var i = byteLength - 1
	  var mul = 1
	  var sub = 0
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
	      sub = 1
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }

	  return offset + byteLength
	}

	Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  if (value < 0) value = 0xff + value + 1
	  this[offset] = (value & 0xff)
	  return offset + 1
	}

	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = (value & 0xff)
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}

	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 3] = (value >>> 24)
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}

	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (value < 0) value = 0xffffffff + value + 1
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}

	function checkIEEE754 (buf, value, offset, ext, max, min) {
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	  if (offset < 0) throw new RangeError('Index out of range')
	}

	function writeFloat (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 23, 4)
	  return offset + 4
	}

	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, true, noAssert)
	}

	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, false, noAssert)
	}

	function writeDouble (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 52, 8)
	  return offset + 8
	}

	Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, true, noAssert)
	}

	Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, false, noAssert)
	}

	// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
	Buffer.prototype.copy = function copy (target, targetStart, start, end) {
	  if (!start) start = 0
	  if (!end && end !== 0) end = this.length
	  if (targetStart >= target.length) targetStart = target.length
	  if (!targetStart) targetStart = 0
	  if (end > 0 && end < start) end = start

	  // Copy 0 bytes; we're done
	  if (end === start) return 0
	  if (target.length === 0 || this.length === 0) return 0

	  // Fatal error conditions
	  if (targetStart < 0) {
	    throw new RangeError('targetStart out of bounds')
	  }
	  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
	  if (end < 0) throw new RangeError('sourceEnd out of bounds')

	  // Are we oob?
	  if (end > this.length) end = this.length
	  if (target.length - targetStart < end - start) {
	    end = target.length - targetStart + start
	  }

	  var len = end - start
	  var i

	  if (this === target && start < targetStart && targetStart < end) {
	    // descending copy from end
	    for (i = len - 1; i >= 0; --i) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
	    // ascending copy from start
	    for (i = 0; i < len; ++i) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else {
	    Uint8Array.prototype.set.call(
	      target,
	      this.subarray(start, start + len),
	      targetStart
	    )
	  }

	  return len
	}

	// Usage:
	//    buffer.fill(number[, offset[, end]])
	//    buffer.fill(buffer[, offset[, end]])
	//    buffer.fill(string[, offset[, end]][, encoding])
	Buffer.prototype.fill = function fill (val, start, end, encoding) {
	  // Handle string cases:
	  if (typeof val === 'string') {
	    if (typeof start === 'string') {
	      encoding = start
	      start = 0
	      end = this.length
	    } else if (typeof end === 'string') {
	      encoding = end
	      end = this.length
	    }
	    if (val.length === 1) {
	      var code = val.charCodeAt(0)
	      if (code < 256) {
	        val = code
	      }
	    }
	    if (encoding !== undefined && typeof encoding !== 'string') {
	      throw new TypeError('encoding must be a string')
	    }
	    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
	      throw new TypeError('Unknown encoding: ' + encoding)
	    }
	  } else if (typeof val === 'number') {
	    val = val & 255
	  }

	  // Invalid ranges are not set to a default, so can range check early.
	  if (start < 0 || this.length < start || this.length < end) {
	    throw new RangeError('Out of range index')
	  }

	  if (end <= start) {
	    return this
	  }

	  start = start >>> 0
	  end = end === undefined ? this.length : end >>> 0

	  if (!val) val = 0

	  var i
	  if (typeof val === 'number') {
	    for (i = start; i < end; ++i) {
	      this[i] = val
	    }
	  } else {
	    var bytes = Buffer.isBuffer(val)
	      ? val
	      : utf8ToBytes(new Buffer(val, encoding).toString())
	    var len = bytes.length
	    for (i = 0; i < end - start; ++i) {
	      this[i + start] = bytes[i % len]
	    }
	  }

	  return this
	}

	// HELPER FUNCTIONS
	// ================

	var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

	function base64clean (str) {
	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
	  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
	  // Node converts strings with length < 2 to ''
	  if (str.length < 2) return ''
	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
	  while (str.length % 4 !== 0) {
	    str = str + '='
	  }
	  return str
	}

	function stringtrim (str) {
	  if (str.trim) return str.trim()
	  return str.replace(/^\s+|\s+$/g, '')
	}

	function toHex (n) {
	  if (n < 16) return '0' + n.toString(16)
	  return n.toString(16)
	}

	function utf8ToBytes (string, units) {
	  units = units || Infinity
	  var codePoint
	  var length = string.length
	  var leadSurrogate = null
	  var bytes = []

	  for (var i = 0; i < length; ++i) {
	    codePoint = string.charCodeAt(i)

	    // is surrogate component
	    if (codePoint > 0xD7FF && codePoint < 0xE000) {
	      // last char was a lead
	      if (!leadSurrogate) {
	        // no lead yet
	        if (codePoint > 0xDBFF) {
	          // unexpected trail
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        } else if (i + 1 === length) {
	          // unpaired lead
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        }

	        // valid lead
	        leadSurrogate = codePoint

	        continue
	      }

	      // 2 leads in a row
	      if (codePoint < 0xDC00) {
	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	        leadSurrogate = codePoint
	        continue
	      }

	      // valid surrogate pair
	      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
	    } else if (leadSurrogate) {
	      // valid bmp char, but last char was a lead
	      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	    }

	    leadSurrogate = null

	    // encode utf8
	    if (codePoint < 0x80) {
	      if ((units -= 1) < 0) break
	      bytes.push(codePoint)
	    } else if (codePoint < 0x800) {
	      if ((units -= 2) < 0) break
	      bytes.push(
	        codePoint >> 0x6 | 0xC0,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x10000) {
	      if ((units -= 3) < 0) break
	      bytes.push(
	        codePoint >> 0xC | 0xE0,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x110000) {
	      if ((units -= 4) < 0) break
	      bytes.push(
	        codePoint >> 0x12 | 0xF0,
	        codePoint >> 0xC & 0x3F | 0x80,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else {
	      throw new Error('Invalid code point')
	    }
	  }

	  return bytes
	}

	function asciiToBytes (str) {
	  var byteArray = []
	  for (var i = 0; i < str.length; ++i) {
	    // Node's code seems to be doing this and not & 0x7F..
	    byteArray.push(str.charCodeAt(i) & 0xFF)
	  }
	  return byteArray
	}

	function utf16leToBytes (str, units) {
	  var c, hi, lo
	  var byteArray = []
	  for (var i = 0; i < str.length; ++i) {
	    if ((units -= 2) < 0) break

	    c = str.charCodeAt(i)
	    hi = c >> 8
	    lo = c % 256
	    byteArray.push(lo)
	    byteArray.push(hi)
	  }

	  return byteArray
	}

	function base64ToBytes (str) {
	  return base64.toByteArray(base64clean(str))
	}

	function blitBuffer (src, dst, offset, length) {
	  for (var i = 0; i < length; ++i) {
	    if ((i + offset >= dst.length) || (i >= src.length)) break
	    dst[i + offset] = src[i]
	  }
	  return i
	}

	function isnan (val) {
	  return val !== val // eslint-disable-line no-self-compare
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 39 */
/***/ function(module, exports) {

	'use strict'

	exports.byteLength = byteLength
	exports.toByteArray = toByteArray
	exports.fromByteArray = fromByteArray

	var lookup = []
	var revLookup = []
	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	for (var i = 0, len = code.length; i < len; ++i) {
	  lookup[i] = code[i]
	  revLookup[code.charCodeAt(i)] = i
	}

	revLookup['-'.charCodeAt(0)] = 62
	revLookup['_'.charCodeAt(0)] = 63

	function placeHoldersCount (b64) {
	  var len = b64.length
	  if (len % 4 > 0) {
	    throw new Error('Invalid string. Length must be a multiple of 4')
	  }

	  // the number of equal signs (place holders)
	  // if there are two placeholders, than the two characters before it
	  // represent one byte
	  // if there is only one, then the three characters before it represent 2 bytes
	  // this is just a cheap hack to not do indexOf twice
	  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
	}

	function byteLength (b64) {
	  // base64 is 4/3 + up to two characters of the original data
	  return b64.length * 3 / 4 - placeHoldersCount(b64)
	}

	function toByteArray (b64) {
	  var i, j, l, tmp, placeHolders, arr
	  var len = b64.length
	  placeHolders = placeHoldersCount(b64)

	  arr = new Arr(len * 3 / 4 - placeHolders)

	  // if there are placeholders, only get up to the last complete 4 chars
	  l = placeHolders > 0 ? len - 4 : len

	  var L = 0

	  for (i = 0, j = 0; i < l; i += 4, j += 3) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
	    arr[L++] = (tmp >> 16) & 0xFF
	    arr[L++] = (tmp >> 8) & 0xFF
	    arr[L++] = tmp & 0xFF
	  }

	  if (placeHolders === 2) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
	    arr[L++] = tmp & 0xFF
	  } else if (placeHolders === 1) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
	    arr[L++] = (tmp >> 8) & 0xFF
	    arr[L++] = tmp & 0xFF
	  }

	  return arr
	}

	function tripletToBase64 (num) {
	  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
	}

	function encodeChunk (uint8, start, end) {
	  var tmp
	  var output = []
	  for (var i = start; i < end; i += 3) {
	    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
	    output.push(tripletToBase64(tmp))
	  }
	  return output.join('')
	}

	function fromByteArray (uint8) {
	  var tmp
	  var len = uint8.length
	  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
	  var output = ''
	  var parts = []
	  var maxChunkLength = 16383 // must be multiple of 3

	  // go through the array every three bytes, we'll deal with trailing stuff later
	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
	    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
	  }

	  // pad the end with zeros, but make sure to not forget the extra bytes
	  if (extraBytes === 1) {
	    tmp = uint8[len - 1]
	    output += lookup[tmp >> 2]
	    output += lookup[(tmp << 4) & 0x3F]
	    output += '=='
	  } else if (extraBytes === 2) {
	    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
	    output += lookup[tmp >> 10]
	    output += lookup[(tmp >> 4) & 0x3F]
	    output += lookup[(tmp << 2) & 0x3F]
	    output += '='
	  }

	  parts.push(output)

	  return parts.join('')
	}


/***/ },
/* 40 */
/***/ function(module, exports) {

	exports.read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var nBits = -7
	  var i = isLE ? (nBytes - 1) : 0
	  var d = isLE ? -1 : 1
	  var s = buffer[offset + i]

	  i += d

	  e = s & ((1 << (-nBits)) - 1)
	  s >>= (-nBits)
	  nBits += eLen
	  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & ((1 << (-nBits)) - 1)
	  e >>= (-nBits)
	  nBits += mLen
	  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen)
	    e = e - eBias
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	}

	exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
	  var i = isLE ? 0 : (nBytes - 1)
	  var d = isLE ? 1 : -1
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

	  value = Math.abs(value)

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0
	    e = eMax
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2)
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--
	      c *= 2
	    }
	    if (e + eBias >= 1) {
	      value += rt / c
	    } else {
	      value += rt * Math.pow(2, 1 - eBias)
	    }
	    if (value * c >= 2) {
	      e++
	      c /= 2
	    }

	    if (e + eBias >= eMax) {
	      m = 0
	      e = eMax
	    } else if (e + eBias >= 1) {
	      m = (value * c - 1) * Math.pow(2, mLen)
	      e = e + eBias
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
	      e = 0
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = (e << mLen) | m
	  eLen += mLen
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128
	}


/***/ },
/* 41 */
/***/ function(module, exports) {

	var toString = {}.toString;

	module.exports = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};


/***/ },
/* 42 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {'use strict';

	var buffer = __webpack_require__(38);
	var Buffer = buffer.Buffer;
	var SlowBuffer = buffer.SlowBuffer;
	var MAX_LEN = buffer.kMaxLength || 2147483647;
	exports.alloc = function alloc(size, fill, encoding) {
	  if (typeof Buffer.alloc === 'function') {
	    return Buffer.alloc(size, fill, encoding);
	  }
	  if (typeof encoding === 'number') {
	    throw new TypeError('encoding must not be number');
	  }
	  if (typeof size !== 'number') {
	    throw new TypeError('size must be a number');
	  }
	  if (size > MAX_LEN) {
	    throw new RangeError('size is too large');
	  }
	  var enc = encoding;
	  var _fill = fill;
	  if (_fill === undefined) {
	    enc = undefined;
	    _fill = 0;
	  }
	  var buf = new Buffer(size);
	  if (typeof _fill === 'string') {
	    var fillBuf = new Buffer(_fill, enc);
	    var flen = fillBuf.length;
	    var i = -1;
	    while (++i < size) {
	      buf[i] = fillBuf[i % flen];
	    }
	  } else {
	    buf.fill(_fill);
	  }
	  return buf;
	}
	exports.allocUnsafe = function allocUnsafe(size) {
	  if (typeof Buffer.allocUnsafe === 'function') {
	    return Buffer.allocUnsafe(size);
	  }
	  if (typeof size !== 'number') {
	    throw new TypeError('size must be a number');
	  }
	  if (size > MAX_LEN) {
	    throw new RangeError('size is too large');
	  }
	  return new Buffer(size);
	}
	exports.from = function from(value, encodingOrOffset, length) {
	  if (typeof Buffer.from === 'function' && (!global.Uint8Array || Uint8Array.from !== Buffer.from)) {
	    return Buffer.from(value, encodingOrOffset, length);
	  }
	  if (typeof value === 'number') {
	    throw new TypeError('"value" argument must not be a number');
	  }
	  if (typeof value === 'string') {
	    return new Buffer(value, encodingOrOffset);
	  }
	  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
	    var offset = encodingOrOffset;
	    if (arguments.length === 1) {
	      return new Buffer(value);
	    }
	    if (typeof offset === 'undefined') {
	      offset = 0;
	    }
	    var len = length;
	    if (typeof len === 'undefined') {
	      len = value.byteLength - offset;
	    }
	    if (offset >= value.byteLength) {
	      throw new RangeError('\'offset\' is out of bounds');
	    }
	    if (len > value.byteLength - offset) {
	      throw new RangeError('\'length\' is out of bounds');
	    }
	    return new Buffer(value.slice(offset, offset + len));
	  }
	  if (Buffer.isBuffer(value)) {
	    var out = new Buffer(value.length);
	    value.copy(out, 0, 0, value.length);
	    return out;
	  }
	  if (value) {
	    if (Array.isArray(value) || (typeof ArrayBuffer !== 'undefined' && value.buffer instanceof ArrayBuffer) || 'length' in value) {
	      return new Buffer(value);
	    }
	    if (value.type === 'Buffer' && Array.isArray(value.data)) {
	      return new Buffer(value.data);
	    }
	  }

	  throw new TypeError('First argument must be a string, Buffer, ' + 'ArrayBuffer, Array, or array-like object.');
	}
	exports.allocUnsafeSlow = function allocUnsafeSlow(size) {
	  if (typeof Buffer.allocUnsafeSlow === 'function') {
	    return Buffer.allocUnsafeSlow(size);
	  }
	  if (typeof size !== 'number') {
	    throw new TypeError('size must be a number');
	  }
	  if (size >= MAX_LEN) {
	    throw new RangeError('size is too large');
	  }
	  return new SlowBuffer(size);
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(Buffer) {// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	// NOTE: These type checking functions intentionally don't use `instanceof`
	// because it is fragile and can be easily faked with `Object.create()`.

	function isArray(arg) {
	  if (Array.isArray) {
	    return Array.isArray(arg);
	  }
	  return objectToString(arg) === '[object Array]';
	}
	exports.isArray = isArray;

	function isBoolean(arg) {
	  return typeof arg === 'boolean';
	}
	exports.isBoolean = isBoolean;

	function isNull(arg) {
	  return arg === null;
	}
	exports.isNull = isNull;

	function isNullOrUndefined(arg) {
	  return arg == null;
	}
	exports.isNullOrUndefined = isNullOrUndefined;

	function isNumber(arg) {
	  return typeof arg === 'number';
	}
	exports.isNumber = isNumber;

	function isString(arg) {
	  return typeof arg === 'string';
	}
	exports.isString = isString;

	function isSymbol(arg) {
	  return typeof arg === 'symbol';
	}
	exports.isSymbol = isSymbol;

	function isUndefined(arg) {
	  return arg === void 0;
	}
	exports.isUndefined = isUndefined;

	function isRegExp(re) {
	  return objectToString(re) === '[object RegExp]';
	}
	exports.isRegExp = isRegExp;

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}
	exports.isObject = isObject;

	function isDate(d) {
	  return objectToString(d) === '[object Date]';
	}
	exports.isDate = isDate;

	function isError(e) {
	  return (objectToString(e) === '[object Error]' || e instanceof Error);
	}
	exports.isError = isError;

	function isFunction(arg) {
	  return typeof arg === 'function';
	}
	exports.isFunction = isFunction;

	function isPrimitive(arg) {
	  return arg === null ||
	         typeof arg === 'boolean' ||
	         typeof arg === 'number' ||
	         typeof arg === 'string' ||
	         typeof arg === 'symbol' ||  // ES6 symbol
	         typeof arg === 'undefined';
	}
	exports.isPrimitive = isPrimitive;

	exports.isBuffer = Buffer.isBuffer;

	function objectToString(o) {
	  return Object.prototype.toString.call(o);
	}

	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(38).Buffer))

/***/ },
/* 44 */
/***/ function(module, exports) {

	/* (ignored) */

/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var Buffer = __webpack_require__(38).Buffer;
	/*<replacement>*/
	var bufferShim = __webpack_require__(42);
	/*</replacement>*/

	module.exports = BufferList;

	function BufferList() {
	  this.head = null;
	  this.tail = null;
	  this.length = 0;
	}

	BufferList.prototype.push = function (v) {
	  var entry = { data: v, next: null };
	  if (this.length > 0) this.tail.next = entry;else this.head = entry;
	  this.tail = entry;
	  ++this.length;
	};

	BufferList.prototype.unshift = function (v) {
	  var entry = { data: v, next: this.head };
	  if (this.length === 0) this.tail = entry;
	  this.head = entry;
	  ++this.length;
	};

	BufferList.prototype.shift = function () {
	  if (this.length === 0) return;
	  var ret = this.head.data;
	  if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
	  --this.length;
	  return ret;
	};

	BufferList.prototype.clear = function () {
	  this.head = this.tail = null;
	  this.length = 0;
	};

	BufferList.prototype.join = function (s) {
	  if (this.length === 0) return '';
	  var p = this.head;
	  var ret = '' + p.data;
	  while (p = p.next) {
	    ret += s + p.data;
	  }return ret;
	};

	BufferList.prototype.concat = function (n) {
	  if (this.length === 0) return bufferShim.alloc(0);
	  if (this.length === 1) return this.head.data;
	  var ret = bufferShim.allocUnsafe(n >>> 0);
	  var p = this.head;
	  var i = 0;
	  while (p) {
	    p.data.copy(ret, i);
	    i += p.data.length;
	    p = p.next;
	  }
	  return ret;
	};

/***/ },
/* 46 */
/***/ function(module, exports, __webpack_require__) {

	// a duplex stream is just a stream that is both readable and writable.
	// Since JS doesn't have multiple prototypal inheritance, this class
	// prototypally inherits from Readable, and then parasitically from
	// Writable.

	'use strict';

	/*<replacement>*/

	var objectKeys = Object.keys || function (obj) {
	  var keys = [];
	  for (var key in obj) {
	    keys.push(key);
	  }return keys;
	};
	/*</replacement>*/

	module.exports = Duplex;

	/*<replacement>*/
	var processNextTick = __webpack_require__(36);
	/*</replacement>*/

	/*<replacement>*/
	var util = __webpack_require__(43);
	util.inherits = __webpack_require__(4);
	/*</replacement>*/

	var Readable = __webpack_require__(35);
	var Writable = __webpack_require__(47);

	util.inherits(Duplex, Readable);

	var keys = objectKeys(Writable.prototype);
	for (var v = 0; v < keys.length; v++) {
	  var method = keys[v];
	  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
	}

	function Duplex(options) {
	  if (!(this instanceof Duplex)) return new Duplex(options);

	  Readable.call(this, options);
	  Writable.call(this, options);

	  if (options && options.readable === false) this.readable = false;

	  if (options && options.writable === false) this.writable = false;

	  this.allowHalfOpen = true;
	  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

	  this.once('end', onend);
	}

	// the no-half-open enforcer
	function onend() {
	  // if we allow half-open state, or if the writable side ended,
	  // then we're ok.
	  if (this.allowHalfOpen || this._writableState.ended) return;

	  // no more data can be written.
	  // But allow more writes to happen in this tick.
	  processNextTick(onEndNT, this);
	}

	function onEndNT(self) {
	  self.end();
	}

	function forEach(xs, f) {
	  for (var i = 0, l = xs.length; i < l; i++) {
	    f(xs[i], i);
	  }
	}

/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process, setImmediate) {// A bit simpler than readable streams.
	// Implement an async ._write(chunk, encoding, cb), and it'll handle all
	// the drain event emission and buffering.

	'use strict';

	module.exports = Writable;

	/*<replacement>*/
	var processNextTick = __webpack_require__(36);
	/*</replacement>*/

	/*<replacement>*/
	var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : processNextTick;
	/*</replacement>*/

	/*<replacement>*/
	var Duplex;
	/*</replacement>*/

	Writable.WritableState = WritableState;

	/*<replacement>*/
	var util = __webpack_require__(43);
	util.inherits = __webpack_require__(4);
	/*</replacement>*/

	/*<replacement>*/
	var internalUtil = {
	  deprecate: __webpack_require__(50)
	};
	/*</replacement>*/

	/*<replacement>*/
	var Stream;
	(function () {
	  try {
	    Stream = __webpack_require__(33);
	  } catch (_) {} finally {
	    if (!Stream) Stream = __webpack_require__(3).EventEmitter;
	  }
	})();
	/*</replacement>*/

	var Buffer = __webpack_require__(38).Buffer;
	/*<replacement>*/
	var bufferShim = __webpack_require__(42);
	/*</replacement>*/

	util.inherits(Writable, Stream);

	function nop() {}

	function WriteReq(chunk, encoding, cb) {
	  this.chunk = chunk;
	  this.encoding = encoding;
	  this.callback = cb;
	  this.next = null;
	}

	function WritableState(options, stream) {
	  Duplex = Duplex || __webpack_require__(46);

	  options = options || {};

	  // object stream flag to indicate whether or not this stream
	  // contains buffers or objects.
	  this.objectMode = !!options.objectMode;

	  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

	  // the point at which write() starts returning false
	  // Note: 0 is a valid value, means that we always return false if
	  // the entire buffer is not flushed immediately on write()
	  var hwm = options.highWaterMark;
	  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
	  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

	  // cast to ints.
	  this.highWaterMark = ~~this.highWaterMark;

	  // drain event flag.
	  this.needDrain = false;
	  // at the start of calling end()
	  this.ending = false;
	  // when end() has been called, and returned
	  this.ended = false;
	  // when 'finish' is emitted
	  this.finished = false;

	  // should we decode strings into buffers before passing to _write?
	  // this is here so that some node-core streams can optimize string
	  // handling at a lower level.
	  var noDecode = options.decodeStrings === false;
	  this.decodeStrings = !noDecode;

	  // Crypto is kind of old and crusty.  Historically, its default string
	  // encoding is 'binary' so we have to make this configurable.
	  // Everything else in the universe uses 'utf8', though.
	  this.defaultEncoding = options.defaultEncoding || 'utf8';

	  // not an actual buffer we keep track of, but a measurement
	  // of how much we're waiting to get pushed to some underlying
	  // socket or file.
	  this.length = 0;

	  // a flag to see when we're in the middle of a write.
	  this.writing = false;

	  // when true all writes will be buffered until .uncork() call
	  this.corked = 0;

	  // a flag to be able to tell if the onwrite cb is called immediately,
	  // or on a later tick.  We set this to true at first, because any
	  // actions that shouldn't happen until "later" should generally also
	  // not happen before the first write call.
	  this.sync = true;

	  // a flag to know if we're processing previously buffered items, which
	  // may call the _write() callback in the same tick, so that we don't
	  // end up in an overlapped onwrite situation.
	  this.bufferProcessing = false;

	  // the callback that's passed to _write(chunk,cb)
	  this.onwrite = function (er) {
	    onwrite(stream, er);
	  };

	  // the callback that the user supplies to write(chunk,encoding,cb)
	  this.writecb = null;

	  // the amount that is being written when _write is called.
	  this.writelen = 0;

	  this.bufferedRequest = null;
	  this.lastBufferedRequest = null;

	  // number of pending user-supplied write callbacks
	  // this must be 0 before 'finish' can be emitted
	  this.pendingcb = 0;

	  // emit prefinish if the only thing we're waiting for is _write cbs
	  // This is relevant for synchronous Transform streams
	  this.prefinished = false;

	  // True if the error was already emitted and should not be thrown again
	  this.errorEmitted = false;

	  // count buffered requests
	  this.bufferedRequestCount = 0;

	  // allocate the first CorkedRequest, there is always
	  // one allocated and free to use, and we maintain at most two
	  this.corkedRequestsFree = new CorkedRequest(this);
	}

	WritableState.prototype.getBuffer = function getBuffer() {
	  var current = this.bufferedRequest;
	  var out = [];
	  while (current) {
	    out.push(current);
	    current = current.next;
	  }
	  return out;
	};

	(function () {
	  try {
	    Object.defineProperty(WritableState.prototype, 'buffer', {
	      get: internalUtil.deprecate(function () {
	        return this.getBuffer();
	      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
	    });
	  } catch (_) {}
	})();

	// Test _writableState for inheritance to account for Duplex streams,
	// whose prototype chain only points to Readable.
	var realHasInstance;
	if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
	  realHasInstance = Function.prototype[Symbol.hasInstance];
	  Object.defineProperty(Writable, Symbol.hasInstance, {
	    value: function (object) {
	      if (realHasInstance.call(this, object)) return true;

	      return object && object._writableState instanceof WritableState;
	    }
	  });
	} else {
	  realHasInstance = function (object) {
	    return object instanceof this;
	  };
	}

	function Writable(options) {
	  Duplex = Duplex || __webpack_require__(46);

	  // Writable ctor is applied to Duplexes, too.
	  // `realHasInstance` is necessary because using plain `instanceof`
	  // would return false, as no `_writableState` property is attached.

	  // Trying to use the custom `instanceof` for Writable here will also break the
	  // Node.js LazyTransform implementation, which has a non-trivial getter for
	  // `_writableState` that would lead to infinite recursion.
	  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
	    return new Writable(options);
	  }

	  this._writableState = new WritableState(options, this);

	  // legacy.
	  this.writable = true;

	  if (options) {
	    if (typeof options.write === 'function') this._write = options.write;

	    if (typeof options.writev === 'function') this._writev = options.writev;
	  }

	  Stream.call(this);
	}

	// Otherwise people can pipe Writable streams, which is just wrong.
	Writable.prototype.pipe = function () {
	  this.emit('error', new Error('Cannot pipe, not readable'));
	};

	function writeAfterEnd(stream, cb) {
	  var er = new Error('write after end');
	  // TODO: defer error events consistently everywhere, not just the cb
	  stream.emit('error', er);
	  processNextTick(cb, er);
	}

	// Checks that a user-supplied chunk is valid, especially for the particular
	// mode the stream is in. Currently this means that `null` is never accepted
	// and undefined/non-string values are only allowed in object mode.
	function validChunk(stream, state, chunk, cb) {
	  var valid = true;
	  var er = false;

	  if (chunk === null) {
	    er = new TypeError('May not write null values to stream');
	  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
	    er = new TypeError('Invalid non-string/buffer chunk');
	  }
	  if (er) {
	    stream.emit('error', er);
	    processNextTick(cb, er);
	    valid = false;
	  }
	  return valid;
	}

	Writable.prototype.write = function (chunk, encoding, cb) {
	  var state = this._writableState;
	  var ret = false;
	  var isBuf = Buffer.isBuffer(chunk);

	  if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

	  if (typeof cb !== 'function') cb = nop;

	  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
	    state.pendingcb++;
	    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
	  }

	  return ret;
	};

	Writable.prototype.cork = function () {
	  var state = this._writableState;

	  state.corked++;
	};

	Writable.prototype.uncork = function () {
	  var state = this._writableState;

	  if (state.corked) {
	    state.corked--;

	    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
	  }
	};

	Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
	  // node::ParseEncoding() requires lower case.
	  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
	  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
	  this._writableState.defaultEncoding = encoding;
	  return this;
	};

	function decodeChunk(state, chunk, encoding) {
	  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
	    chunk = bufferShim.from(chunk, encoding);
	  }
	  return chunk;
	}

	// if we're already writing something, then just put this
	// in the queue, and wait our turn.  Otherwise, call _write
	// If we return false, then we need a drain event, so set that flag.
	function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
	  if (!isBuf) {
	    chunk = decodeChunk(state, chunk, encoding);
	    if (Buffer.isBuffer(chunk)) encoding = 'buffer';
	  }
	  var len = state.objectMode ? 1 : chunk.length;

	  state.length += len;

	  var ret = state.length < state.highWaterMark;
	  // we must ensure that previous needDrain will not be reset to false.
	  if (!ret) state.needDrain = true;

	  if (state.writing || state.corked) {
	    var last = state.lastBufferedRequest;
	    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
	    if (last) {
	      last.next = state.lastBufferedRequest;
	    } else {
	      state.bufferedRequest = state.lastBufferedRequest;
	    }
	    state.bufferedRequestCount += 1;
	  } else {
	    doWrite(stream, state, false, len, chunk, encoding, cb);
	  }

	  return ret;
	}

	function doWrite(stream, state, writev, len, chunk, encoding, cb) {
	  state.writelen = len;
	  state.writecb = cb;
	  state.writing = true;
	  state.sync = true;
	  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
	  state.sync = false;
	}

	function onwriteError(stream, state, sync, er, cb) {
	  --state.pendingcb;
	  if (sync) processNextTick(cb, er);else cb(er);

	  stream._writableState.errorEmitted = true;
	  stream.emit('error', er);
	}

	function onwriteStateUpdate(state) {
	  state.writing = false;
	  state.writecb = null;
	  state.length -= state.writelen;
	  state.writelen = 0;
	}

	function onwrite(stream, er) {
	  var state = stream._writableState;
	  var sync = state.sync;
	  var cb = state.writecb;

	  onwriteStateUpdate(state);

	  if (er) onwriteError(stream, state, sync, er, cb);else {
	    // Check if we're actually ready to finish, but don't emit yet
	    var finished = needFinish(state);

	    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
	      clearBuffer(stream, state);
	    }

	    if (sync) {
	      /*<replacement>*/
	      asyncWrite(afterWrite, stream, state, finished, cb);
	      /*</replacement>*/
	    } else {
	      afterWrite(stream, state, finished, cb);
	    }
	  }
	}

	function afterWrite(stream, state, finished, cb) {
	  if (!finished) onwriteDrain(stream, state);
	  state.pendingcb--;
	  cb();
	  finishMaybe(stream, state);
	}

	// Must force callback to be called on nextTick, so that we don't
	// emit 'drain' before the write() consumer gets the 'false' return
	// value, and has a chance to attach a 'drain' listener.
	function onwriteDrain(stream, state) {
	  if (state.length === 0 && state.needDrain) {
	    state.needDrain = false;
	    stream.emit('drain');
	  }
	}

	// if there's something in the buffer waiting, then process it
	function clearBuffer(stream, state) {
	  state.bufferProcessing = true;
	  var entry = state.bufferedRequest;

	  if (stream._writev && entry && entry.next) {
	    // Fast case, write everything using _writev()
	    var l = state.bufferedRequestCount;
	    var buffer = new Array(l);
	    var holder = state.corkedRequestsFree;
	    holder.entry = entry;

	    var count = 0;
	    while (entry) {
	      buffer[count] = entry;
	      entry = entry.next;
	      count += 1;
	    }

	    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

	    // doWrite is almost always async, defer these to save a bit of time
	    // as the hot path ends with doWrite
	    state.pendingcb++;
	    state.lastBufferedRequest = null;
	    if (holder.next) {
	      state.corkedRequestsFree = holder.next;
	      holder.next = null;
	    } else {
	      state.corkedRequestsFree = new CorkedRequest(state);
	    }
	  } else {
	    // Slow case, write chunks one-by-one
	    while (entry) {
	      var chunk = entry.chunk;
	      var encoding = entry.encoding;
	      var cb = entry.callback;
	      var len = state.objectMode ? 1 : chunk.length;

	      doWrite(stream, state, false, len, chunk, encoding, cb);
	      entry = entry.next;
	      // if we didn't call the onwrite immediately, then
	      // it means that we need to wait until it does.
	      // also, that means that the chunk and cb are currently
	      // being processed, so move the buffer counter past them.
	      if (state.writing) {
	        break;
	      }
	    }

	    if (entry === null) state.lastBufferedRequest = null;
	  }

	  state.bufferedRequestCount = 0;
	  state.bufferedRequest = entry;
	  state.bufferProcessing = false;
	}

	Writable.prototype._write = function (chunk, encoding, cb) {
	  cb(new Error('_write() is not implemented'));
	};

	Writable.prototype._writev = null;

	Writable.prototype.end = function (chunk, encoding, cb) {
	  var state = this._writableState;

	  if (typeof chunk === 'function') {
	    cb = chunk;
	    chunk = null;
	    encoding = null;
	  } else if (typeof encoding === 'function') {
	    cb = encoding;
	    encoding = null;
	  }

	  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

	  // .end() fully uncorks
	  if (state.corked) {
	    state.corked = 1;
	    this.uncork();
	  }

	  // ignore unnecessary end() calls.
	  if (!state.ending && !state.finished) endWritable(this, state, cb);
	};

	function needFinish(state) {
	  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
	}

	function prefinish(stream, state) {
	  if (!state.prefinished) {
	    state.prefinished = true;
	    stream.emit('prefinish');
	  }
	}

	function finishMaybe(stream, state) {
	  var need = needFinish(state);
	  if (need) {
	    if (state.pendingcb === 0) {
	      prefinish(stream, state);
	      state.finished = true;
	      stream.emit('finish');
	    } else {
	      prefinish(stream, state);
	    }
	  }
	  return need;
	}

	function endWritable(stream, state, cb) {
	  state.ending = true;
	  finishMaybe(stream, state);
	  if (cb) {
	    if (state.finished) processNextTick(cb);else stream.once('finish', cb);
	  }
	  state.ended = true;
	  stream.writable = false;
	}

	// It seems a linked list but it is not
	// there will be only 2 of these for each stream
	function CorkedRequest(state) {
	  var _this = this;

	  this.next = null;
	  this.entry = null;
	  this.finish = function (err) {
	    var entry = _this.entry;
	    _this.entry = null;
	    while (entry) {
	      var cb = entry.callback;
	      state.pendingcb--;
	      cb(err);
	      entry = entry.next;
	    }
	    if (state.corkedRequestsFree) {
	      state.corkedRequestsFree.next = _this;
	    } else {
	      state.corkedRequestsFree = _this;
	    }
	  };
	}
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(7), __webpack_require__(48).setImmediate))

/***/ },
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	var apply = Function.prototype.apply;

	// DOM APIs, for completeness

	exports.setTimeout = function() {
	  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
	};
	exports.setInterval = function() {
	  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
	};
	exports.clearTimeout =
	exports.clearInterval = function(timeout) {
	  if (timeout) {
	    timeout.close();
	  }
	};

	function Timeout(id, clearFn) {
	  this._id = id;
	  this._clearFn = clearFn;
	}
	Timeout.prototype.unref = Timeout.prototype.ref = function() {};
	Timeout.prototype.close = function() {
	  this._clearFn.call(window, this._id);
	};

	// Does not start the time, just sets up the members needed.
	exports.enroll = function(item, msecs) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = msecs;
	};

	exports.unenroll = function(item) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = -1;
	};

	exports._unrefActive = exports.active = function(item) {
	  clearTimeout(item._idleTimeoutId);

	  var msecs = item._idleTimeout;
	  if (msecs >= 0) {
	    item._idleTimeoutId = setTimeout(function onTimeout() {
	      if (item._onTimeout)
	        item._onTimeout();
	    }, msecs);
	  }
	};

	// setimmediate attaches itself to the global object
	__webpack_require__(49);
	exports.setImmediate = setImmediate;
	exports.clearImmediate = clearImmediate;


/***/ },
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, process) {(function (global, undefined) {
	    "use strict";

	    if (global.setImmediate) {
	        return;
	    }

	    var nextHandle = 1; // Spec says greater than zero
	    var tasksByHandle = {};
	    var currentlyRunningATask = false;
	    var doc = global.document;
	    var registerImmediate;

	    function setImmediate(callback) {
	      // Callback can either be a function or a string
	      if (typeof callback !== "function") {
	        callback = new Function("" + callback);
	      }
	      // Copy function arguments
	      var args = new Array(arguments.length - 1);
	      for (var i = 0; i < args.length; i++) {
	          args[i] = arguments[i + 1];
	      }
	      // Store and register the task
	      var task = { callback: callback, args: args };
	      tasksByHandle[nextHandle] = task;
	      registerImmediate(nextHandle);
	      return nextHandle++;
	    }

	    function clearImmediate(handle) {
	        delete tasksByHandle[handle];
	    }

	    function run(task) {
	        var callback = task.callback;
	        var args = task.args;
	        switch (args.length) {
	        case 0:
	            callback();
	            break;
	        case 1:
	            callback(args[0]);
	            break;
	        case 2:
	            callback(args[0], args[1]);
	            break;
	        case 3:
	            callback(args[0], args[1], args[2]);
	            break;
	        default:
	            callback.apply(undefined, args);
	            break;
	        }
	    }

	    function runIfPresent(handle) {
	        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
	        // So if we're currently running a task, we'll need to delay this invocation.
	        if (currentlyRunningATask) {
	            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
	            // "too much recursion" error.
	            setTimeout(runIfPresent, 0, handle);
	        } else {
	            var task = tasksByHandle[handle];
	            if (task) {
	                currentlyRunningATask = true;
	                try {
	                    run(task);
	                } finally {
	                    clearImmediate(handle);
	                    currentlyRunningATask = false;
	                }
	            }
	        }
	    }

	    function installNextTickImplementation() {
	        registerImmediate = function(handle) {
	            process.nextTick(function () { runIfPresent(handle); });
	        };
	    }

	    function canUsePostMessage() {
	        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
	        // where `global.postMessage` means something completely different and can't be used for this purpose.
	        if (global.postMessage && !global.importScripts) {
	            var postMessageIsAsynchronous = true;
	            var oldOnMessage = global.onmessage;
	            global.onmessage = function() {
	                postMessageIsAsynchronous = false;
	            };
	            global.postMessage("", "*");
	            global.onmessage = oldOnMessage;
	            return postMessageIsAsynchronous;
	        }
	    }

	    function installPostMessageImplementation() {
	        // Installs an event handler on `global` for the `message` event: see
	        // * https://developer.mozilla.org/en/DOM/window.postMessage
	        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

	        var messagePrefix = "setImmediate$" + Math.random() + "$";
	        var onGlobalMessage = function(event) {
	            if (event.source === global &&
	                typeof event.data === "string" &&
	                event.data.indexOf(messagePrefix) === 0) {
	                runIfPresent(+event.data.slice(messagePrefix.length));
	            }
	        };

	        if (global.addEventListener) {
	            global.addEventListener("message", onGlobalMessage, false);
	        } else {
	            global.attachEvent("onmessage", onGlobalMessage);
	        }

	        registerImmediate = function(handle) {
	            global.postMessage(messagePrefix + handle, "*");
	        };
	    }

	    function installMessageChannelImplementation() {
	        var channel = new MessageChannel();
	        channel.port1.onmessage = function(event) {
	            var handle = event.data;
	            runIfPresent(handle);
	        };

	        registerImmediate = function(handle) {
	            channel.port2.postMessage(handle);
	        };
	    }

	    function installReadyStateChangeImplementation() {
	        var html = doc.documentElement;
	        registerImmediate = function(handle) {
	            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
	            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
	            var script = doc.createElement("script");
	            script.onreadystatechange = function () {
	                runIfPresent(handle);
	                script.onreadystatechange = null;
	                html.removeChild(script);
	                script = null;
	            };
	            html.appendChild(script);
	        };
	    }

	    function installSetTimeoutImplementation() {
	        registerImmediate = function(handle) {
	            setTimeout(runIfPresent, 0, handle);
	        };
	    }

	    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
	    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
	    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

	    // Don't get fooled by e.g. browserify environments.
	    if ({}.toString.call(global.process) === "[object process]") {
	        // For Node.js before 0.9
	        installNextTickImplementation();

	    } else if (canUsePostMessage()) {
	        // For non-IE10 modern browsers
	        installPostMessageImplementation();

	    } else if (global.MessageChannel) {
	        // For web workers, where supported
	        installMessageChannelImplementation();

	    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
	        // For IE 6–8
	        installReadyStateChangeImplementation();

	    } else {
	        // For older browsers
	        installSetTimeoutImplementation();
	    }

	    attachTo.setImmediate = setImmediate;
	    attachTo.clearImmediate = clearImmediate;
	}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(7)))

/***/ },
/* 50 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/**
	 * Module exports.
	 */

	module.exports = deprecate;

	/**
	 * Mark that a method should not be used.
	 * Returns a modified function which warns once by default.
	 *
	 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
	 *
	 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
	 * will throw an Error when invoked.
	 *
	 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
	 * will invoke `console.trace()` instead of `console.error()`.
	 *
	 * @param {Function} fn - the function to deprecate
	 * @param {String} msg - the string to print to the console when `fn` is invoked
	 * @returns {Function} a new "deprecated" version of `fn`
	 * @api public
	 */

	function deprecate (fn, msg) {
	  if (config('noDeprecation')) {
	    return fn;
	  }

	  var warned = false;
	  function deprecated() {
	    if (!warned) {
	      if (config('throwDeprecation')) {
	        throw new Error(msg);
	      } else if (config('traceDeprecation')) {
	        console.trace(msg);
	      } else {
	        console.warn(msg);
	      }
	      warned = true;
	    }
	    return fn.apply(this, arguments);
	  }

	  return deprecated;
	}

	/**
	 * Checks `localStorage` for boolean values for the given `name`.
	 *
	 * @param {String} name
	 * @returns {Boolean}
	 * @api private
	 */

	function config (name) {
	  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
	  try {
	    if (!global.localStorage) return false;
	  } catch (_) {
	    return false;
	  }
	  var val = global.localStorage[name];
	  if (null == val) return false;
	  return String(val).toLowerCase() === 'true';
	}

	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 51 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	var Buffer = __webpack_require__(38).Buffer;

	var isBufferEncoding = Buffer.isEncoding
	  || function(encoding) {
	       switch (encoding && encoding.toLowerCase()) {
	         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
	         default: return false;
	       }
	     }


	function assertEncoding(encoding) {
	  if (encoding && !isBufferEncoding(encoding)) {
	    throw new Error('Unknown encoding: ' + encoding);
	  }
	}

	// StringDecoder provides an interface for efficiently splitting a series of
	// buffers into a series of JS strings without breaking apart multi-byte
	// characters. CESU-8 is handled as part of the UTF-8 encoding.
	//
	// @TODO Handling all encodings inside a single object makes it very difficult
	// to reason about this code, so it should be split up in the future.
	// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
	// points as used by CESU-8.
	var StringDecoder = exports.StringDecoder = function(encoding) {
	  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
	  assertEncoding(encoding);
	  switch (this.encoding) {
	    case 'utf8':
	      // CESU-8 represents each of Surrogate Pair by 3-bytes
	      this.surrogateSize = 3;
	      break;
	    case 'ucs2':
	    case 'utf16le':
	      // UTF-16 represents each of Surrogate Pair by 2-bytes
	      this.surrogateSize = 2;
	      this.detectIncompleteChar = utf16DetectIncompleteChar;
	      break;
	    case 'base64':
	      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
	      this.surrogateSize = 3;
	      this.detectIncompleteChar = base64DetectIncompleteChar;
	      break;
	    default:
	      this.write = passThroughWrite;
	      return;
	  }

	  // Enough space to store all bytes of a single character. UTF-8 needs 4
	  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
	  this.charBuffer = new Buffer(6);
	  // Number of bytes received for the current incomplete multi-byte character.
	  this.charReceived = 0;
	  // Number of bytes expected for the current incomplete multi-byte character.
	  this.charLength = 0;
	};


	// write decodes the given buffer and returns it as JS string that is
	// guaranteed to not contain any partial multi-byte characters. Any partial
	// character found at the end of the buffer is buffered up, and will be
	// returned when calling write again with the remaining bytes.
	//
	// Note: Converting a Buffer containing an orphan surrogate to a String
	// currently works, but converting a String to a Buffer (via `new Buffer`, or
	// Buffer#write) will replace incomplete surrogates with the unicode
	// replacement character. See https://codereview.chromium.org/121173009/ .
	StringDecoder.prototype.write = function(buffer) {
	  var charStr = '';
	  // if our last write ended with an incomplete multibyte character
	  while (this.charLength) {
	    // determine how many remaining bytes this buffer has to offer for this char
	    var available = (buffer.length >= this.charLength - this.charReceived) ?
	        this.charLength - this.charReceived :
	        buffer.length;

	    // add the new bytes to the char buffer
	    buffer.copy(this.charBuffer, this.charReceived, 0, available);
	    this.charReceived += available;

	    if (this.charReceived < this.charLength) {
	      // still not enough chars in this buffer? wait for more ...
	      return '';
	    }

	    // remove bytes belonging to the current character from the buffer
	    buffer = buffer.slice(available, buffer.length);

	    // get the character that was split
	    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

	    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	    var charCode = charStr.charCodeAt(charStr.length - 1);
	    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	      this.charLength += this.surrogateSize;
	      charStr = '';
	      continue;
	    }
	    this.charReceived = this.charLength = 0;

	    // if there are no more bytes in this buffer, just emit our char
	    if (buffer.length === 0) {
	      return charStr;
	    }
	    break;
	  }

	  // determine and set charLength / charReceived
	  this.detectIncompleteChar(buffer);

	  var end = buffer.length;
	  if (this.charLength) {
	    // buffer the incomplete character bytes we got
	    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
	    end -= this.charReceived;
	  }

	  charStr += buffer.toString(this.encoding, 0, end);

	  var end = charStr.length - 1;
	  var charCode = charStr.charCodeAt(end);
	  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
	  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
	    var size = this.surrogateSize;
	    this.charLength += size;
	    this.charReceived += size;
	    this.charBuffer.copy(this.charBuffer, size, 0, size);
	    buffer.copy(this.charBuffer, 0, 0, size);
	    return charStr.substring(0, end);
	  }

	  // or just emit the charStr
	  return charStr;
	};

	// detectIncompleteChar determines if there is an incomplete UTF-8 character at
	// the end of the given buffer. If so, it sets this.charLength to the byte
	// length that character, and sets this.charReceived to the number of bytes
	// that are available for this character.
	StringDecoder.prototype.detectIncompleteChar = function(buffer) {
	  // determine how many bytes we have to check at the end of this buffer
	  var i = (buffer.length >= 3) ? 3 : buffer.length;

	  // Figure out if one of the last i bytes of our buffer announces an
	  // incomplete char.
	  for (; i > 0; i--) {
	    var c = buffer[buffer.length - i];

	    // See http://en.wikipedia.org/wiki/UTF-8#Description

	    // 110XXXXX
	    if (i == 1 && c >> 5 == 0x06) {
	      this.charLength = 2;
	      break;
	    }

	    // 1110XXXX
	    if (i <= 2 && c >> 4 == 0x0E) {
	      this.charLength = 3;
	      break;
	    }

	    // 11110XXX
	    if (i <= 3 && c >> 3 == 0x1E) {
	      this.charLength = 4;
	      break;
	    }
	  }
	  this.charReceived = i;
	};

	StringDecoder.prototype.end = function(buffer) {
	  var res = '';
	  if (buffer && buffer.length)
	    res = this.write(buffer);

	  if (this.charReceived) {
	    var cr = this.charReceived;
	    var buf = this.charBuffer;
	    var enc = this.encoding;
	    res += buf.slice(0, cr).toString(enc);
	  }

	  return res;
	};

	function passThroughWrite(buffer) {
	  return buffer.toString(this.encoding);
	}

	function utf16DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 2;
	  this.charLength = this.charReceived ? 2 : 0;
	}

	function base64DetectIncompleteChar(buffer) {
	  this.charReceived = buffer.length % 3;
	  this.charLength = this.charReceived ? 3 : 0;
	}


/***/ },
/* 52 */
/***/ function(module, exports, __webpack_require__) {

	// a transform stream is a readable/writable stream where you do
	// something with the data.  Sometimes it's called a "filter",
	// but that's not a great name for it, since that implies a thing where
	// some bits pass through, and others are simply ignored.  (That would
	// be a valid example of a transform, of course.)
	//
	// While the output is causally related to the input, it's not a
	// necessarily symmetric or synchronous transformation.  For example,
	// a zlib stream might take multiple plain-text writes(), and then
	// emit a single compressed chunk some time in the future.
	//
	// Here's how this works:
	//
	// The Transform stream has all the aspects of the readable and writable
	// stream classes.  When you write(chunk), that calls _write(chunk,cb)
	// internally, and returns false if there's a lot of pending writes
	// buffered up.  When you call read(), that calls _read(n) until
	// there's enough pending readable data buffered up.
	//
	// In a transform stream, the written data is placed in a buffer.  When
	// _read(n) is called, it transforms the queued up data, calling the
	// buffered _write cb's as it consumes chunks.  If consuming a single
	// written chunk would result in multiple output chunks, then the first
	// outputted bit calls the readcb, and subsequent chunks just go into
	// the read buffer, and will cause it to emit 'readable' if necessary.
	//
	// This way, back-pressure is actually determined by the reading side,
	// since _read has to be called to start processing a new chunk.  However,
	// a pathological inflate type of transform can cause excessive buffering
	// here.  For example, imagine a stream where every byte of input is
	// interpreted as an integer from 0-255, and then results in that many
	// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
	// 1kb of data being output.  In this case, you could write a very small
	// amount of input, and end up with a very large amount of output.  In
	// such a pathological inflating mechanism, there'd be no way to tell
	// the system to stop doing the transform.  A single 4MB write could
	// cause the system to run out of memory.
	//
	// However, even in such a pathological case, only a single written chunk
	// would be consumed, and then the rest would wait (un-transformed) until
	// the results of the previous transformed chunk were consumed.

	'use strict';

	module.exports = Transform;

	var Duplex = __webpack_require__(46);

	/*<replacement>*/
	var util = __webpack_require__(43);
	util.inherits = __webpack_require__(4);
	/*</replacement>*/

	util.inherits(Transform, Duplex);

	function TransformState(stream) {
	  this.afterTransform = function (er, data) {
	    return afterTransform(stream, er, data);
	  };

	  this.needTransform = false;
	  this.transforming = false;
	  this.writecb = null;
	  this.writechunk = null;
	  this.writeencoding = null;
	}

	function afterTransform(stream, er, data) {
	  var ts = stream._transformState;
	  ts.transforming = false;

	  var cb = ts.writecb;

	  if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

	  ts.writechunk = null;
	  ts.writecb = null;

	  if (data !== null && data !== undefined) stream.push(data);

	  cb(er);

	  var rs = stream._readableState;
	  rs.reading = false;
	  if (rs.needReadable || rs.length < rs.highWaterMark) {
	    stream._read(rs.highWaterMark);
	  }
	}

	function Transform(options) {
	  if (!(this instanceof Transform)) return new Transform(options);

	  Duplex.call(this, options);

	  this._transformState = new TransformState(this);

	  var stream = this;

	  // start out asking for a readable event once data is transformed.
	  this._readableState.needReadable = true;

	  // we have implemented the _read method, and done the other things
	  // that Readable wants before the first _read call, so unset the
	  // sync guard flag.
	  this._readableState.sync = false;

	  if (options) {
	    if (typeof options.transform === 'function') this._transform = options.transform;

	    if (typeof options.flush === 'function') this._flush = options.flush;
	  }

	  // When the writable side finishes, then flush out anything remaining.
	  this.once('prefinish', function () {
	    if (typeof this._flush === 'function') this._flush(function (er, data) {
	      done(stream, er, data);
	    });else done(stream);
	  });
	}

	Transform.prototype.push = function (chunk, encoding) {
	  this._transformState.needTransform = false;
	  return Duplex.prototype.push.call(this, chunk, encoding);
	};

	// This is the part where you do stuff!
	// override this function in implementation classes.
	// 'chunk' is an input chunk.
	//
	// Call `push(newChunk)` to pass along transformed output
	// to the readable side.  You may call 'push' zero or more times.
	//
	// Call `cb(err)` when you are done with this chunk.  If you pass
	// an error, then that'll put the hurt on the whole operation.  If you
	// never call cb(), then you'll never get another chunk.
	Transform.prototype._transform = function (chunk, encoding, cb) {
	  throw new Error('_transform() is not implemented');
	};

	Transform.prototype._write = function (chunk, encoding, cb) {
	  var ts = this._transformState;
	  ts.writecb = cb;
	  ts.writechunk = chunk;
	  ts.writeencoding = encoding;
	  if (!ts.transforming) {
	    var rs = this._readableState;
	    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
	  }
	};

	// Doesn't matter what the args are here.
	// _transform does all the work.
	// That we got here means that the readable side wants more data.
	Transform.prototype._read = function (n) {
	  var ts = this._transformState;

	  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
	    ts.transforming = true;
	    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
	  } else {
	    // mark that we need a transform, so that any data that comes in
	    // will get processed, now that we've asked for it.
	    ts.needTransform = true;
	  }
	};

	function done(stream, er, data) {
	  if (er) return stream.emit('error', er);

	  if (data !== null && data !== undefined) stream.push(data);

	  // if there's nothing in the write buffer, then that means
	  // that nothing more will ever be provided
	  var ws = stream._writableState;
	  var ts = stream._transformState;

	  if (ws.length) throw new Error('Calling transform done when ws.length != 0');

	  if (ts.transforming) throw new Error('Calling transform done when still transforming');

	  return stream.push(null);
	}

/***/ },
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	// a passthrough stream.
	// basically just the most minimal sort of Transform stream.
	// Every written chunk gets output as-is.

	'use strict';

	module.exports = PassThrough;

	var Transform = __webpack_require__(52);

	/*<replacement>*/
	var util = __webpack_require__(43);
	util.inherits = __webpack_require__(4);
	/*</replacement>*/

	util.inherits(PassThrough, Transform);

	function PassThrough(options) {
	  if (!(this instanceof PassThrough)) return new PassThrough(options);

	  Transform.call(this, options);
	}

	PassThrough.prototype._transform = function (chunk, encoding, cb) {
	  cb(null, chunk);
	};

/***/ },
/* 54 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(47)


/***/ },
/* 55 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(46)


/***/ },
/* 56 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(52)


/***/ },
/* 57 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(53)


/***/ }
/******/ ]);