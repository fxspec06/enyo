(function() {
	/* jshint node: true */
	var
		fs = require("fs"),
		path = require("path"),
		walker = require("walker"),
		uglify = require("uglify-js"),
		nopt = require("nopt"),
		less = require("less");
		RezInd = require('less-plugin-resolution-independence');

	var basename = path.basename(__filename),
		w = console.log,
		e = console.error,
		defaultEnyoLoc = "enyo",
		defaultLibLoc = "lib",
		opt;

	// Shimming path.relative with 0.8.8's version if it doesn't exist
	if(!path.relative){
		path.relative = require('./path-relative-shim').relative;
	}

	function printUsage() {
		w("Enyo 2.0 Minifier");
		w("Usage: " + __filename + " [Flags] [path/to/package.js]");
		w("Flags:");
		w("-no-less:", "Don't compile less; instead substitute css for less");
		w("-ri", "Perform LESS resolution-independence conversion of measurements i.e. px to rem");
		w("-no-alias:", "Don't use path macros");
		w("-alias:", "Give paths a macroized alias");
		w("-enyo ENYOPATH:", "Relative path to enyo folder (enyo)");
		w("-lib LIBPATH:", "Relative path to lib folder ($enyo/../lib)");
		w("-destdir DESTDIR:", "Target directory, prepended to any output file but skipped within generated files (current dir)");
		w("-output RELPATH/PREFIX:", "Folder + output file prefix, relative to DESTDIR (build/out)");
		w("-beautify:", "Output pretty version that's less compressed but has code on separate lines");
		w("-f", "Remote source mapping: from local path");
		w("-t", "Remote source mapping: to remote path");
		w("-gathering:", "Gathering libs to default location, so rewrite urls accordingly");
		w("-h, -?, -help:", "Show this message");
	}

	// properly split path based on platform
	function pathSplit(inPath) {
		var sep = process.platform == "win32" ? "\\" : "/";
		return inPath.split(sep);
	}

	function concatCss(sheets, doneCB) {
		w("");
		var blob = "";
		var addToBlob = function(sheet, code) {
			// for the "gathering" feature, we need to determine whether this sheet lives
			// inside a lib directory; normalizing the path makes it easier to check, below
			sheet = path.normalize(sheet);
			// fix url paths
			code = code.replace(/(?!url\((?:['"])?(?:data:|https?|(?:file:)?\/\/))url\((['"])?([a-zA-Z0-9\ \.\/\-~&%#:+=_?]*)\1\)/g,
				function (uri, char, content) {
					var rel, dest;
					// we do nothing if there was nothing even though this is probably not intended 
					// by the author let a true CSS parser deal with the flaws
					if (!content) return uri;
					// if the initial character is from a relative IRI (say, a nested entry from 
					// inline SVG encoded utf8 instead of base64) we leave it alone
					// it would be # in standard utf8
					if (content.charAt(0) == '#') return uri;
					// @note this is where the limitation sets in (so we don't do crazy things to
					// cover a very rare use-case that can be avoided) where we do not decode uri-
					// encoded relative paths, rewrite them, and re-encode them, however this will
					// work with relative IRI's (using # for the same document -> %23 when encoded)
					if (/^%23/.test(content)) return uri;
					// if we are gathering libs to default location, rewrite urls beneath lib folder
					dest = opt.gathering && sheet.indexOf(opt.lib) === 0
						? defaultLibLoc + sheet.substr(opt.lib.length)
						: sheet;
					// leaving this because this was working according to these build tools 
					// specific needs
					rel = path.join('..', opt.relsrcdir, path.dirname(dest), content);
					// for sanity we wrap all URI's safely with single quote
					return 'url(\'' + rel + '\')';
				}
			);
			blob += "\n/* " + path.relative(process.cwd(), sheet) + " */\n\n" + code + "\n";
		};
		// Pops one sheet off the sheets[] array, reads (and parses if less), and then
		// recurses again from the async callback until no sheets left, then calls doneCB
		function readAndParse() {
			var sheet = sheets.shift(),
				ri = new RezInd();
			if (sheet) {
				w(sheet);
				var isLess = (sheet.slice(-4) == "less");
				if (isLess && (opt.less !== true)) {
					sheet = sheet.slice(0, sheet.length-4) + "css";
					isLess = false;
					w(" (Substituting CSS: " + sheet + ")");
				}
				var code = fs.readFileSync(sheet, "utf8");
				if (isLess) {
					var parser = new(less.Parser)({filename:sheet, paths:[path.dirname(sheet)], relativeUrls:true});
					parser.parse(code, function (err, tree) {
						if (err) {
							console.error(err);
						} else {
							var generatedCss;
							if (opt.ri) {
								generatedCss = tree.toCSS({plugins: [ri]});
							} else {
								generatedCss = tree.toCSS();
							}
							addToBlob(sheet, generatedCss);
						}
						readAndParse(sheets);
					});
				} else {
					addToBlob(sheet, code);
					readAndParse(sheets);
				}
			} else {
				doneCB(blob);
			}
		}
		readAndParse();
	}

	var concatJs = function(loader, scripts) {
		w("");
		var blob = "";
		for (var i=0, script; (script=scripts[i]); i++) {
			w(script);
			blob += "\n// " + path.relative(process.cwd(), script) + "\n" + compressJsFile(script) + "\n";
		}
		return blob;
	};

	var compressJsFile = function(inPath) {
		var outputOpts = {
//			beautify: false,
//			indent_level: 4,
			ascii_only: true
		};
		if (opt.beautify) {
			outputOpts.beautify = true;
			outputOpts.indent_level = 4;
		}
		var result = uglify.minify(inPath, {output: outputOpts});
		return result.code;
	};

	var walkerFinished = function(loader, chunks) {
		var outfolder = path.dirname(path.join(opt.destdir, opt.output));
		var exists = fs.existsSync || path.existsSync;
		var currChunk = 1;
		var topDepends;
		if (outfolder != "." && !exists(outfolder)) {
			fs.mkdirSync(outfolder);
		}
		if ((chunks.length == 1) && (typeof chunks[0] == "object")) {
			topDepends = false;
			currChunk = "";
		} else {
			topDepends = [];
		}
		var processNextChunk = function(done) {
			if (chunks.length > 0) {
				var chunk = chunks.shift();
				if (typeof chunk == "string") {
					topDepends.push(chunk);
					processNextChunk(done);
				} else {
					concatCss(chunk.sheets, function(css) {
						if (css.length) {
							w("");
							var cssFile = opt.output + currChunk + ".css";
							fs.writeFileSync(path.resolve(opt.destdir, cssFile), css, "utf8");
							if (topDepends) {
								topDepends.push(cssFile);
							}
						}
						var js = concatJs(loader, chunk.scripts);
						if (js.length) {
							w("");
							var jsFile = opt.output + currChunk + ".js";
							fs.writeFileSync(path.resolve(opt.destdir, jsFile), js, "utf8");
							if (topDepends) {
								topDepends.push(jsFile);
							}
						}
						currChunk++;
						processNextChunk(done);
					});
				}
			} else {
				done();
			}
		};
		processNextChunk(function() {
			if (topDepends) {
				var js = "";
				// Add path aliases to the mapped sources
				for (var i=0; i<opt.mapfrom.length; i++) {
					js = js + "enyo.path.addPath(\"" + opt.mapfrom[i] + "\", \"" + opt.mapto[i] + "\");\n";
				}
				// Override the default rule that $lib lives next to $enyo, since enyo may be remote
				js = js + "enyo.path.addPath(\"lib\", \"lib\");\n";
				// Add depends for all of the top-level files
				js = js + "enyo.depends(\n\t\"" + topDepends.join("\",\n\t\"") + "\"\n);";
				fs.writeFileSync(path.resolve(opt.destdir, opt.output + ".js"), js, "utf8");
				fs.writeFileSync(path.resolve(opt.destdir, opt.output + ".css"), "/* CSS loaded via enyo.depends() call in " + opt.output + ".js */", "utf8");
			}

			w("");
			w("done.");
			w("");

			// required to properly terminate a
			// node.process.fork() call, as defined by
			// <http://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options>
			process.exit(0);
		});
	};

	var knownOpts = {
		"alias": Boolean,
		"enyo": String,   // relative path
		"lib": String,    // relative path
		"destdir": path,  // absolute path (resolved by nopt)
		"srcdir": path,   // absolute path (resolved by nopt)
		"output": String, // relative path
		"help": Boolean,
		"beautify": Boolean,
		"mapfrom": [String, Array],
		"mapto": [String, Array],
		"gathering": Boolean,
		"ri": Boolean
	};

	var shortHands = {
		"alias": ['--alias'],
		"enyo": ['--enyo'],
		"lib": ['--lib'],
		"srcdir": ['--srcdir'],
		"destdir": ['--destdir'],
		"output": ['--output'],
		"h": ['--help'],
		"?": ['--help'],
		"help": ['--help'],
		"beautify": ['--beautify'],
		"f": ['--mapfrom'],
		"t": ['--mapto'],
		"ri": ['--ri']
	};

	opt = nopt(knownOpts, shortHands, process.argv, 2);
	opt.packagejs = opt.argv.remain[0] || "package.js";
	opt.srcdir = opt.srcdir || process.cwd();
	if (opt.packagejs) {
		// walker only works from top-level package.js...
		process.chdir(path.dirname(opt.packagejs));
	}
	// ...but we still want to (relatively) track the top of the
	// tree, because this is the root from which the LESS sheets
	// are resolved (unlike the JS dependencies, which are
	// resolved from the folder of the top-level package.js).
	opt.relsrcdir = path.relative(opt.srcdir, process.cwd());

	if (opt.help) {
		printUsage();
		process.exit();
	}

	// Send message to parent node process, if any
	process.on('uncaughtException', function (err) {
		e(err.stack);
		if (process.send) {
			// only available if parent-process is node
			process.send({error: err});
		}
		process.exit(1);
	});
	// receive error messages from child node processes
	process.on('message', function(msg) {
		console.dir(basename, msg);
		if (msg.error && msg.error.stack) {
			console.error(basename, msg.error.stack);
		}
		if (process.send) {
			process.send(msg);
		}
	});

	opt.destdir = opt.destdir || process.cwd();
	opt.output = opt.output || "build/out";
	if (path.resolve(opt.output) === opt.output) {
		throw new Error("-output must be a relative path prefix");
	}

	opt.enyo = opt.enyo || defaultEnyoLoc;

	opt.lib = opt.lib || path.join(opt.enyo, "../lib");
	opt.gathering = opt.gathering && (opt.lib != defaultLibLoc);

	w(opt);
	walker.init(opt.enyo, opt.lib, opt.mapfrom, opt.mapto);
	walker.walk(path.basename(opt.packagejs), walkerFinished);

})();
