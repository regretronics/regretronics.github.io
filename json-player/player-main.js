//finds item in arr and remove from it.
//currently an in-place operation, not functional.
function removeFrom(arr, item) {
	if(!item) return;
	let i = arr.indexOf(item);
	if(i >= 0) {arr.splice(i, 1);}
}

var playing = false;
function defOnEnded() {
	//remove modules from list.
	removeFrom(oscs, this);
	removeFrom(gains, this.assocGain1);
	removeFrom(gains, this.assocGain2);
	removeFrom(gains, this.assocGain3);
	if(oscs.length == 0) {stop();}
}

function audioTimer() {
	if(!playing) return;
	outAudioT.innerText = audioCtx.currentTime.toFixed(2);
	window.setTimeout(audioTimer, 100);
}

//to do: note release time? (so that duration may affect nonspecified next noteStart, but release won't)
var struct, flatStruct;
const defaultFreqScale = 1, defaultVol = 1, defaultTimeScale = 1, defaultTimeDelta = 0, defaultDecayFactor = 256, defaultAttack = 0.125;
//play() assumes that a flattened representation already exists in ctlFlatScript.innerText.
function play() {
	if(playing) return;
	playing = true;
	if(!audioCtx) {audioCtx = new AudioContext();}
	audioTimer();
	
	let playFreqScale = nullToDefault(parseNumber(txtPlayFreqScale.value), defaultFreqScale);
	let playVolScale = nullToDefault(parseNumber(txtPlayVolScale.value), defaultVol);
	let playTimeScale = nullToDefault(parseNumber(txtPlayTimeScale.value), defaultTimeScale);
	let playTimeDelta = nullToDefault(parseNumber(txtPlayTimeDelta.value), defaultTimeDelta);
	let flatStruct = JSON.parse(ctlFlatScript.innerText);
	let t0 = audioCtx.currentTime + playTimeDelta;
	//to do: ?gradually enter notes
	//let iStart = 0, iStop = 0;
	let len = flatStruct.length;
	for(let i = 0, noteFreq, noteStart, noteStop, osc1, gain1, gain2, gain3; i < len; i++) {
		//in the flattened structure, all notes must have frequency.
		if(!flatStruct[i].freq) continue;
		noteFreq = playFreqScale * flatStruct[i].freq;
		noteStart = playTimeScale * flatStruct[i].noteStart;
		noteStop = playTimeScale * flatStruct[i].noteStop;

		osc1 = audioCtx.createOscillator();
		oscs.push(osc1);
		osc1.type = "sine";
		osc1.frequency.value = noteFreq;
		osc1.onended = defOnEnded;

		//to do: review this (looks wrong)
		//volume scale and decay (from vol to 0)
		gain1 = audioCtx.createGain();
		gains.push(gain1);
		gain1.gain.value = playVolScale * (flatStruct[i].hasOwnProperty("vol") ? flatStruct[i].vol : defaultVol);
		let decayFactor = flatStruct[i].decayFactor;
		if(!decayFactor) decayFactor = defaultDecayFactor;
		//to do: should decay factor be subject to playTimeScale?
		gain1.gain.setTargetAtTime(0, t0 + noteStart, decayFactor / noteFreq);
		osc1.connect(gain1);
		osc1.assocGain1 = gain1;
		
		//volume attack (from 0 to 1)
		gain2 = audioCtx.createGain();
		gains.push(gain2);
		gain2.gain.value = 0;
		let attack = flatStruct[i].attack;
		if(!attack) attack = defaultAttack;
		//to do: should attack time be subject to playTimeScale?
		gain2.gain.setTargetAtTime(1, t0 + noteStart, playTimeScale * attack);
		gain1.connect(gain2);
		osc1.assocGain2 = gain2;
		
		//volume decay within note time
		//wtf have i done here?
		if(noteStop > noteStart) {
			gain3 = audioCtx.createGain();
			gains.push(gain3);
			gain3.gain.setValueCurveAtTime(releaseCurve, t0 + noteStart, noteStop - noteStart);
			gain2.connect(gain3);
			osc1.assocGain3 = gain3;

			gain3.connect(audioCtx.destination);
		} else {
			osc1.assocGain3 = null;
			gain2.connect(audioCtx.destination);
		}
		
		//osc1.start(t0 + noteStart, 0, t0 + noteStop);
		osc1.start(t0 + noteStart);
		osc1.stop(t0 + noteStop);
	}
	//audioCtx.play();
}
function stop() {
	outAudioT.innerText = audioCtx.currentTime.toFixed(2);
	for(const osc of oscs) {
		osc.stop();
		osc.disconnect();
	}
	oscs = [];
	for(const gain of gains) {
		gain.disconnect();
	}
	gains = [];
	audioCtx = null;
	playing = false;
}

//of course there are infinite primes, but those here are more than enough.
var primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

function nullToDefault(x, def) {
	return x === null ? def : x;
}
//recursive call
function parseNumber(n) {
	if(arguments.length < 1) return null;
	if(n === undefined) return null;
	let t = typeof(n);

	//simpler attempts first.
	if(t === "number") return n;

	//try conversion to number
	//JavaScript converts Number("") and Number([]) to 0. let's prevent this.
	if(!Array.isArray(n) && ((t !== "string") || (n.length != 0))) {
		let ret = Number(n);
		if(!isNaN(ret)) return ret;
	}

	//can be a fraction
	if(t === "string") {
		if(n.length == 0) return null;
		//to do: maybe support addition and subtraction?
		
		//multiplication: "3*4*5" -> 3*(4*5)
		//"*x" = "x*" = 1*x
		let f = n.indexOf("*");
		if(f >= 0) {
			return nullToDefault(parseNumber(n.slice(0, f)), 1)
				* nullToDefault(parseNumber(n.slice(f + 1)), 1);
		} else {
			//division: "3/4/5" -> (3/4)/5
			//"/x" = 1/x
			//"x/" = x/1
			f = n.lastIndexOf("/");
			if(f >= 0) {
				return nullToDefault(parseNumber(n.slice(0, f)), 1)
					/ nullToDefault(parseNumber(n.slice(f + 1)), 1);
			} else {
				//exponentiation: "x^y^z" = x^(y^z)
				//"x^" = x^1
				//"^x" = 2^x?
				f = n.indexOf("^");
				if(f >= 0) {
					return nullToDefault(parseNumber(n.slice(0, f)), 2)
						** nullToDefault(parseNumber(n.slice(f + 1)), 1);
				} else {
					//to do: maybe support parentheses
					//	for that, use regular expressions, like ((\(.*\))|.*)/([^/]*|\(.*\)) for division
					return null;
				}
			}
		}
	}

	//prime factor-based
	let r = 1, i;
	if(Array.isArray(n)) {
		for(i in n) {
			r *= Math.pow(primes[i], nullToDefault(parseNumber(n[i]), 1));
		}
		return r;
	}

	//objects with explicit factors
	for(i in n) {
		//1 as default base neutralizes unrecognized bases
		let iNum = nullToDefault(parseNumber(i), 1);
		if(isNaN(iNum)) continue;
		r *= Math.pow(iNum, nullToDefault(parseNumber(n[i]), 1));
	}
	return r;
}

//recursive call
//to do: put context values into a context object (instead of lots of parameters)
function parseObj(node, _freq, _vol, _time, _timeScale, _decayFactor, _attack) {
	//alter context.
	_time += _timeScale * nullToDefault(parseNumber(node.timeDelta), 0); //additive
	
	//multiplicative
	_timeScale *= nullToDefault(parseNumber(node.timeScale), 1);
	_vol *= nullToDefault(parseNumber(node.volRatio), 1);
	_freq *= nullToDefault(parseNumber(node.freqRatio), 1);

	//absolute
	_decayFactor = nullToDefault(parseNumber(node.decayFactor), _decayFactor);
	_attack = nullToDefault(parseNumber(node.attack), _attack);

	//to do: allow noteStart to be inferred from previous noteStop
	if(node.hasOwnProperty("noteStart")) {
		//register a note.
		let noteVol = nullToDefault(parseNumber(node.vol), defaultVol);
		let noteFreq = nullToDefault(parseNumber(node.freq), defaultFreqScale);

		const defaultNoteStart = 0, defaultDuration = 1;
		node.noteStart = nullToDefault(parseNumber(node.noteStart), defaultNoteStart);
		//if a node doesn't have the duration property, don't add it, because it may be a block. adding it might override noteStop.
		if(node.hasOwnProperty("duration")) {
			node.duration = nullToDefault(parseNumber(node.duration), defaultDuration);
			node.noteStop = node.noteStart + node.duration;
		} else {
			node.noteStop = nullToDefault(parseNumber(node.noteStop), node.noteStart + defaultDuration);
		}
		
		let newNote = {
			noteStart: _time + _timeScale * node.noteStart,
			noteStop: _time + _timeScale * node.noteStop,
			freq: _freq * noteFreq
		};
		noteVol *= _vol;
		if(noteVol != defaultVol) {newNote.vol = noteVol;}
		if(_decayFactor != defaultDecayFactor) {newNote.decayFactor = _decayFactor;}
		if(_attack != defaultAttack) {newNote.attack = _attack;}
		flatStruct.push(newNote);
	}

	for(let iNote = 0, t; t = node[iNote]; iNote++) {
		if(typeof(t) === "string") {
			//pattern invocation, global
			//to do: local first?
			if(struct.hasOwnProperty(t)) {
				parseObj(struct[t],  _freq, _vol, _time, _timeScale, _decayFactor, _attack);
			} else {
				//pattern invocation, local
				if(node.hasOwnProperty(t)) {
					parseObj(node[t],  _freq, _vol, _time, _timeScale, _decayFactor, _attack);
				}
			}
		} else {
			//primary recursion point.
			parseObj(t,  _freq, _vol, _time, _timeScale, _decayFactor, _attack);
		}
	}
}

var hasScriptChanged = false;
function parseScript() {
	try {
		struct = JSON.parse(ctlStructuredScript.innerText);
		flatStruct = []; //out with the old always
		if(Array.isArray(struct)) {
			for(let x of struct) {
				parseObj(x, defaultFreqScale, defaultVol, defaultTimeDelta, defaultTimeScale, defaultDecayFactor, defaultAttack);
			}
		} else {
			parseObj(struct, defaultFreqScale, defaultVol, defaultTimeDelta, defaultTimeScale, defaultDecayFactor, defaultAttack);
		}
		
		//finally, yield the flattened version
		ctlFlatScript.innerText = JSON.stringify(flatStruct, null, "\t");
	} catch(err) {
		//ctlFlatScript.innerText = err.name + ": " + err.message;
		ctlFlatScript.innerText = err.toString();
	}
	//job done, don't do it again
	hasScriptChanged = false;
	btnParseScript.innerText = "Flattened";
}

var flattenTimeoutID;
const flattenInterval = 1000 * 1.5;
function scriptChanged() {
	hasScriptChanged = true;
	btnParseScript.innerText = "Flatten";
	
	if(flattenTimeoutID) {
		window.clearTimeout(flattenTimeoutID);
		flattenTimeoutID = undefined;
	}
	if(autoFlatten) {
		flattenTimeoutID = window.setTimeout(parseScript, flattenInterval);
	}
}

function setAutoFlatten(value) {
	autoFlatten = value;
	if(autoFlatten) {
		if(hasScriptChanged && !flattenTimeoutID) {flattenTimeoutID = window.setTimeout(parseScript, flattenInterval);}
	} else {
		if(flattenTimeoutID) {
			window.clearTimeout(flattenTimeoutID);
			flattenTimeoutID = undefined;
		}
	}
}
