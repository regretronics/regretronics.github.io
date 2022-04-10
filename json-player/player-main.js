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
	if(!playing || !audioCtx) return;
	elems.outAudioT.innerText = audioCtx.currentTime.toFixed(timeDisplPrecision);
	if(audioCtx.state !== 'closed') {window.setTimeout(audioTimer, 100);}
}

var struct, flatStruct, songDuration;
//to do: add note release time? (so that duration may affect nonspecified next noteStart, but release won't)
const defaultBlockNode = {
	freqRatio: 1,
	volRatio: 1,
	timeDelta: 0,
	timeScale: 1,
	decayFactor: 256,
	attack: 0.125
};
const defaultNoteNode = {
	noteStart: 0,
	duration: 1,
	freq: defaultBlockNode.freqRatio,
	vol: defaultBlockNode.volRatio,
	decayFactor: defaultBlockNode.decayFactor,
	attack: defaultBlockNode.attack
};
//play() assumes that a flattened representation already exists in ctlFlatScript.innerText.
function play() {
	if(playing) return;
	let playFreqScale = nullToDefault(parseNumber(elems.txtPlayFreqScale.value), defaultBlockNode.freqRatio);
	if(playFreqScale <= 0) return;
	let playVolScale = nullToDefault(parseNumber(elems.txtPlayVolScale.value), defaultBlockNode.volRatio);
	if(playVolScale < 0) return;
	let playTimeScale = nullToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale);
	if(playTimeScale <= 0) return;
	let playTimeDelta = nullToDefault(parseNumber(elems.txtPlayTimeDelta.value), defaultBlockNode.timeDelta);
	let flatStruct = JSON.parse(elems.ctlFlatScript.innerText);

	songDuration = 0;
	if(!audioCtx) {audioCtx = new AudioContext();}
	audioCtx.suspend();
	playing = true;

	let t0 = audioCtx.currentTime + playTimeDelta;
	//to do: ?progressively enter notes
	//let iStart = 0, iStop = 0;
	let len = flatStruct.length;
	for(let i = 0, note, noteFreq, noteStart, noteStop, osc1, gain1, gain2, gain3; i < len; i++) {
		note = flatStruct[i];
		//in the flattened structure, all notes must have frequency.
		if(!note.freq) continue;
		noteFreq = playFreqScale * note.freq;
		noteStart = playTimeScale * note.noteStart;
		noteStop = playTimeScale * note.noteStop;
		if(noteStop <= noteStart) continue;
		//to do: negative frequency? negative volume? (check if web audio supports phase inversion)

		osc1 = audioCtx.createOscillator();
		oscs.push(osc1);
		osc1.type = "sine";
		osc1.frequency.value = noteFreq;
		osc1.onended = defOnEnded;

		//volume scale and decay (from vol to 0)
		gain1 = audioCtx.createGain();
		gains.push(gain1);
		gain1.gain.value = playVolScale * (note.hasOwnProperty("vol") ? note.vol : defaultNoteNode.vol);
		let decayFactor = note.decayFactor;
		if(!decayFactor) decayFactor = defaultNoteNode.decayFactor;
		//to do: should decay factor be subject to playTimeScale?
		gain1.gain.setTargetAtTime(0, t0 + noteStart, decayFactor / noteFreq);
		osc1.connect(gain1);
		osc1.assocGain1 = gain1;
		
		//volume attack (from 0 to 1)
		gain2 = audioCtx.createGain();
		gains.push(gain2);
		gain2.gain.value = 0;
		let attack = note.attack;
		if(!attack) attack = defaultNoteNode.attack;
		//to do: should attack time be subject to playTimeScale?
		gain2.gain.setTargetAtTime(1, t0 + noteStart, playTimeScale * attack);
		gain1.connect(gain2);
		osc1.assocGain2 = gain2;
		
		if(noteStop > noteStart) {
			//volume decay within note time
			//to do: review this (may be wrong)
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
		songDuration = Math.max(songDuration, t0 + noteStop);
	}
	//audioCtx.play();
	audioCtx.resume();
	outAudioDur.innerText = songDuration.toFixed(timeDisplPrecision);
	audioTimer();
}
function stop() {
	if(audioCtx) {elems.outAudioT.innerText = audioCtx.currentTime.toFixed(timeDisplPrecision);}
	for(const osc of oscs) {
		osc.stop();
		osc.disconnect();
	}
	oscs = [];
	for(const gain of gains) {
		gain.disconnect();
	}
	gains = [];
	playing = false;
	audioCtx = null;
	elems.btnPause.innerHTML = "<u>P</u>ause";
}
function pauseToggle() {
	if(!playing || !audioCtx) return;
	elems.outAudioT.innerText = audioCtx.currentTime.toFixed(timeDisplPrecision);
	if(audioCtx.state === 'closed') return;
	if(audioCtx.state === 'running') {
		audioCtx.suspend();
		elems.btnPause.innerHTML = "Un<u>p</u>ause";
	} else {
		audioCtx.resume();
		elems.btnPause.innerHTML = "<u>P</u>ause";
		window.setTimeout(audioTimer, 100);
	}
}

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
function parseObj(node, blockContext) {
	//alter context.
	let newContext = {};
	Object.assign(newContext, blockContext);
	//to do: bounds check and node elimination? (e.g. when freqRatio <= 0)
	newContext.timeDelta += newContext.timeScale * nullToDefault(parseNumber(node.timeDelta), 0); //additive
	
	//multiplicative
	newContext.timeScale *= nullToDefault(parseNumber(node.timeScale), 1);
	newContext.volRatio *= nullToDefault(parseNumber(node.volRatio), 1);
	newContext.freqRatio *= nullToDefault(parseNumber(node.freqRatio), 1);

	//absolute
	newContext.decayFactor = nullToDefault(parseNumber(node.decayFactor), newContext.decayFactor);
	newContext.attack = nullToDefault(parseNumber(node.attack), newContext.attack);

	//to do: allow noteStart to be inferred from previous noteStop
	if(node.hasOwnProperty("noteStart")) {
		//register a note.
		//const defaultNoteStart = 0, defaultDuration = 1;
		node.noteStart = nullToDefault(parseNumber(node.noteStart), defaultNoteNode.noteStart);
		//if a node doesn't have the duration property, don't add it; adding it might override noteStop.
		if(node.hasOwnProperty("duration")) {
			node.duration = nullToDefault(parseNumber(node.duration), defaultNoteNode.duration);
			node.noteStop = node.noteStart + node.duration;
		} else {
			node.noteStop = nullToDefault(parseNumber(node.noteStop), node.noteStart + defaultNoteNode.duration);
		}
		
		let newNote = {
			noteStart: newContext.timeDelta + newContext.timeScale * node.noteStart,
			noteStop: newContext.timeDelta + newContext.timeScale * node.noteStop,
			freq: newContext.freqRatio * nullToDefault(parseNumber(node.freq), defaultNoteNode.freq)
		};
		let noteVol = newContext.volRatio * nullToDefault(parseNumber(node.vol), defaultNoteNode.vol);
		if(noteVol != defaultNoteNode.vol) {newNote.vol = noteVol;}
		if(newContext.decayFactor != defaultNoteNode.decayFactor) {newNote.decayFactor = newContext.decayFactor;}
		if(newContext.attack != defaultNoteNode.attack) {newNote.attack = newContext.attack;}
		flatStruct.push(newNote);
	}

	for(let iNote = 0, t; t = node[iNote]; iNote++) {
		if(typeof(t) === "string") {
			//pattern invocation, global
			//to do: local first?
			if(struct.hasOwnProperty(t)) {
				parseObj(struct[t],  newContext);
			} else {
				//pattern invocation, local
				if(node.hasOwnProperty(t)) {parseObj(node[t],  newContext);}
			}
		} else {
			//primary recursion point.
			parseObj(t,  newContext);
		}
	}
}

var hasScriptChanged = false;
function parseScript() {
	try {
		struct = JSON.parse(elems.ctlStructuredScript.innerText);
		flatStruct = []; //out with the old always
		if(Array.isArray(struct)) {
			for(let x of struct) {
				parseObj(x, defaultBlockNode);
			}
		} else {
			parseObj(struct, defaultBlockNode);
		}
		
		//finally, yield the flattened version
		let s = JSON.stringify(flatStruct, null, "\t");
		//final adjustments on indentation
		let regex = new RegExp(/\{\n\t{2,}/, "g");
		s = s.replace(regex, "{");
		regex = new RegExp(/\n\t{2,}/, "g");
		s = s.replace(regex, " ");
		regex = new RegExp(/\n\t{1,}\}/, "g");
		s = s.replace(regex, "}");
		elems.ctlFlatScript.innerText = s;
	} catch(err) {
		//elems.ctlFlatScript.innerText = err.name + ": " + err.message;
		elems.ctlFlatScript.innerText = err.toString();
	}
	//job done, don't do it again
	hasScriptChanged = false;
	elems.btnParseScript.innerText = "Flattened";
}

var flattenTimeoutID;
const flattenInterval = 1000 * 1.5;
function scriptChanged() {
	hasScriptChanged = true;
	elems.btnParseScript.innerText = "Flatten";
	
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
