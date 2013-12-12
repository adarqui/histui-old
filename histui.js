var app = app || {};

app.deps = {
	tty		: require('tty'),
	fs		: require('fs'),
	pty		: require('pty.js'),
	kp		: require('keypress'),
	spawn	: require('child_process').spawn,
	_		: require('underscore'),
}

app.conf = {
	sep : '^',
	term : {
		columns	: process.stdout.columns,
		rows	: process.stdout.rows,
		fd		: {},
	},
	dir	: {
		home	: "",
		log		: "",
		here	: "",
		scripts : "",
	},
	argv : {
		oh		: "",
		rest	: [],
		hist	: "",
	},
	hist : {
		a		: [],
		cur		: "",
		cmd		: 0,
		idx		: 0,
		ptr		: 0, // ptr to history index
		collect : 0,
	},
	cmd : {
		a		: {},
	},
	scripts : {
		a		: {},
	},
	alias : {
		a		: {},
	},
	output : {
		a		: [], // normal output
		last	: "", // last 'delim'
		b		: [], // piped output
		eof		: "", // last piped 'delim'
		seps	: [],
	},
}

app.fn = {};

app.fn.hist = {
	cur_back : function() {
		/* This needs to intelligently backspace our stuff */
		if(app.conf.hist.cur.length >= 0) {
if(app.conf.hist.idx == app.conf.hist.cur.length) app.conf.hist.idx = -1;
			app.conf.hist.cur = app.conf.hist.cur.substring(0, app.conf.hist.cur.length - 1);
			if(app.conf.hist.idx >= 0) {
				process.stdout.write('\b');
			}
			else {
				app.conf.hist.cmd = 0;
				app.conf.hist.idx = -1;
				app.conf.term.fd.write('\b');
			}
		}
		else {
			app.conf.hist.cur = "";
		}
	},
	reset : function() {
		app.fn.hist.clear();
		app.conf.hist.ptr = 0;
	},
	clear : function() {
		app.conf.hist.cur		= "";
		app.conf.hist.cmd		= 0;
		app.conf.hist.idx		= -1;
	},
	write : function(s) {
		if(s == undefined) s = "\n";
		app.conf.term.fd.write(s);
	},
	add	: function(ch,key) {

		if((ch == 'U' || ch == 'u') && key && key.shift == true) {
			for(var v in app.conf.hist.cur) {
				app.conf.term.fd.write('\b');
			}
			app.fn.hist.clear();
			if((app.conf.hist.ptr - 1) >= 0) {
				app.conf.hist.ptr-=1;	
			} else { return 1; }
			var fnx = function() { return app.conf.hist.a[app.conf.hist.ptr]; }
			app.conf.hist.cur = fnx();
app.fn.hist.write(app.conf.hist.cur);
			return 1;
		}
		else if(ch == '\r' || ch == '\n') {
			if(app.conf.hist.cur.length == 0) {
				return 0;
			}

			app.conf.hist.a.push(app.conf.hist.cur);
			app.conf.hist.ptr = app.conf.hist.a.length;
			
			app.fn.cmd.parse1();

			app.fn.hist.log(app.conf.hist.cur + "\n");

			app.fn.hist.clear();

		} else if(ch == app.conf.sep) {
			app.conf.hist.cmd = 1;
			app.conf.hist.idx = app.conf.hist.cur.length;
			app.conf.hist.cur = app.conf.hist.cur + app.conf.sep;
		} else {
			app.conf.hist.cur = app.conf.hist.cur + ch;
		}

		if(app.conf.hist.cmd) {
			process.stdout.write(ch);
		}
		
		return app.conf.hist.cmd;
	},
	log: function(s) {
		app.deps.fs.appendFile(app.conf.dir.log, s);
	},
	load: function() {
		app.deps.fs.readFile(app.conf.dir.log, function(err, data) {
			data = data.toString();
			if(err && err.errno > 0) {
				console.log("app.fn.hist.load: Error: readFile");
				return;
			}

			var lines = data.split('\n');
			app.conf.hist.a = lines;
			app.conf.hist.ptr = app.conf.hist.a.length;
		});
	},
	init: function() {
		app.fn.hist.load();
console.log("k");
	},
}

app.fn.misc = {
	die : function() {
		console.log("dead.");
		process.exit(0);
	},
}

app.fn.init = {
	directories: function() {
		var h = process.env['HOME'];
		if(h == undefined) {
			app.fn.misc.die();
		}

		app.conf.dir.here = __dirname;
		app.conf.dir.scripts = app.conf.dir.here + "/scripts";
		app.conf.dir.home = h + "/.histui/";
		app.deps.fs.mkdir(app.conf.dir.home, function(err) {
			console.log("mkdir err");
		} );

	},
	argv: function() {
		if(process.argv[0].indexOf("node") >= 0) {
			process.argv = process.argv.splice(2);
		} else {
			process.argv = process.argv.splice(1);
		}
		console.log("process arg", process.argv);
		app.conf.argv.oh = process.argv[0];
		app.conf.argv.rest = process.argv.splice(1);

		app.conf.argv.hist = app.conf.argv.oh + "_" + app.conf.argv.rest.join('_');
		app.conf.dir.log = app.conf.dir.home + app.conf.argv.hist;
	},
	command: function() {
	
		app.conf.term.fd = app.deps.pty.spawn(app.conf.argv.oh, app.conf.argv.rest, {
			name: 'xterm-color',
			cols: app.conf.term.columns,
			rows: app.conf.term.rows,
			cwd: process.env.HOME,
			env: process.env
		});
	},
	term: function() {

		app.conf.term.fd.on('data', function(data) {

/*
			if(app.conf.hist.collect > 0) {
				console.log("stdout: collect");
				return;
			}
*/


			process.stdout.write(data);

			for(var v in data) {
				if(data[v] == '\n' || data[v] == '\r') {
					if(app.conf.hist.collect > 0) {
						app.conf.output.b.push(app.conf.output.eof);
						app.conf.output.eof = "";
					} else {
						app.conf.output.a.push(app.conf.output.last);
						app.conf.output.last = "";
					}
				}
				else {
					if(app.conf.hist.collect > 0) {
						app.conf.output.eof = app.conf.output.eof + data[v];
						if(app.conf.output.eof.indexOf(app.conf.output.last) >= 0) {
							app.conf.hist.collect = 0;

var obj = {
 seps: app.deps._.clone(app.conf.output.seps),
 buf: "", // this is used for the pipe
}
							app.fn.cmd.parse2(obj);
						}
					} else {
						app.conf.output.last = app.conf.output.last + data[v];
					}
				}
			}

		});


		app.conf.term.fd.on('exit', function() {
			process.exit(0);
		});

		app.deps.kp(process.stdin);

		process.stdin.on('end', function() {
			console.log("end");
			process.exit(0);
		});

		process.stdin.on('keypress', function (ch, key) {

			var ret = 0;

			if(app.conf.hist.collect > 0) {
console.log("collect");
				return;
			}


			/* DONT LOG INPUT */
			if (key && key.ctrl && key.name == 'c') {
				process.exit();
			}

			if(app.conf.hist.cmd > 0) {
				if(key && key.name.indexOf('backspace') >= 0) {
app.fn.hist.cur_back();
					return;
				}
			}

			if(ch == undefined) {
				app.conf.term.fd.write(key.sequence);
				return;
			} else {
				ret = app.fn.hist.add(ch,key);
			}

			if(!ret) {
if(ch == '\n' || ch == '\r') {
/* leave newline crap up to parse1 */
}
else {
				app.conf.term.fd.write(ch);
}
			}

		});

		if (typeof process.stdin.setRawMode == 'function') {
			process.stdin.setRawMode(true);
		} else {
			tty.setRawMode(true);
		}

		process.stdin.resume();

	},
	everything: function() {
		app.fn.init.directories();
		app.fn.init.argv();
		app.fn.cmd.init();
		app.fn.scripts.init();
		app.fn.hist.load();
		app.fn.init.command();
		app.fn.init.term();
		console.log("loaded");
	},
}


app.fn.cmd = {
	parse1 : function() {
		app.conf.output.seps = app.conf.hist.cur.split(app.conf.sep);

		if(app.conf.output.seps.length == 1) { console.log("WTF"); app.fn.hist.write(); return; } ;

		/* This tells us that we are grabbing io */
		app.conf.hist.collect = 1;

		/* Fix 'last', subtract our hist.cur */
		var cur = app.conf.hist.cur.substring(0, app.conf.hist.idx);

		/* Ok, we have to go from the end toward the beginning */
		var cur_len = cur.length;
		var last_len = app.conf.output.last.length;

		var key = app.conf.output.last;
		key = key.substring(0, last_len - cur_len);	
		app.conf.output.last = key;
		app.fn.hist.write();
	},
	parse2 : function(obj) {
		/* Deals with simple commands */
/*
		for(var v in obj.seps) {

*/
			var arr = obj.seps[0].split(/\s+/);
			arr = arr.filter(function(s) {
				if(s.length) return true;
			});

		var y = app.fn.cmd.run(obj, arr[0], arr.splice(1));
		if(y == 1) return;

		app.fn.cmd.parse3(obj);
	},

	parse3 : function(obj) {
		/* Deals with pipes */

			app.fn.scripts.run(obj);
	},

	run	: function(obj, arg0, rest) {


		if(arg0 == undefined) return 0;
		var fn = app.conf.cmd.a[arg0];
		if(fn != undefined) {
			fn(arg0, rest);
			return 1;
		}
		
		return 0;
	},
	hist : function(obj, arg0, rest) {
		console.log("history:\n",app.conf.hist.a,"\n");
	},
	init : function() {
		app.conf.cmd.a["hist"]		= app.fn.cmd.hist;
		app.conf.cmd.a["history"]	= app.fn.cmd.hist;
	},
}

app.fn.scripts = {
	run : function(obj) {

		obj.spawns = {};
		for(var v in obj.seps) {
		
			var arr = obj.seps[v].split(/\s+/);
            arr = arr.filter(function(s) {
                if(s.length) return true;
            });

			obj.spawns[v] = {

            	arg0: arr[0],
            	rest: arr.splice(1),
			}

		}

		var i = 0;
		for(var v in obj.spawns) {
			obj.spawns[v].exec = app.deps.spawn(obj.spawns[v].arg0, obj.spawns[v].rest);

//console.log("EXEC", obj.spawns[v].exec);

			obj.spawns[v].exec.stdout.on('data', function(data) {
			//	if(obj.spawns.length > v
			});

			i++;
		}

		return;
	},
	init : function() {

		app.deps.fs.readdir(app.conf.dir.scripts, function(err, data) {

			if(data.length > 0) {
				for(var v in data) {
					app.conf.scripts.a[data[v]] = {
						exec : app.conf.dir.scripts + "/" + data[v],
					}
				}
			}

		});

	},
}

app.fn.init.everything();
