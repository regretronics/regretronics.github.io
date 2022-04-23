//to do: check performance difference of strict mode?
"use strict";

//to do: consider worker threads, and learn something about worklets (just in case)

//to do: add note release extra time? (so that duration may affect nonspecified next noteStart, but release won't)
const defaultBlockNode = {
	//question: these names are probably lousy and inconsistent. right now i'm not sure of how to improve.
	timeDelta: 0,
	timeScale: 1,

	freqRatio: 1,
	volRatio: 1,

	timbre: "sine",
	decayFactor: 256, //question: rename this to sustain(Factor)?
	attack: 1 / 64
};
const defaultNoteNode = {
	noteStart: 0,
	duration: 1,

	freq: defaultBlockNode.freqRatio,
	vol: defaultBlockNode.volRatio, //negative volumes are supported in the player, and apparently result in phase inversion.

	timbre: defaultBlockNode.timbre,
	decayFactor: defaultBlockNode.decayFactor,
	attack: defaultBlockNode.attack
};

//of course there are infinite primes, but these are more than enough.
var primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47], primeCount;

function nullToDefault(x, def) {
	return x === null ? def : x;
}
//recursive call
function parseNumber(n) {
	//remember: continuation after return => else
	if(arguments.length < 1) return null;
	if(n === undefined) return null;
	let t = typeof(n);

	//simpler attempts first.
	if(t === "number") return n;

	//try conversion to number
	//JavaScript converts Number("") and Number([]) to 0. let's prevent this.
	//to do: consider changing test order (arrays first?).
	if(!Array.isArray(n) && ((t !== "string") || (n.length != 0))) {
		let ret = Number(n);
		if(!isNaN(ret)) return ret;
	}

	if(t === "string") {
		if(n.length == 0) return null;
		
		try {
			//can be an object
			n = JSON.parse(n);
		} catch (error) {
			//can be an expression
			//operators, starting from low precedence
			//addition: "3+4+5" -> 3+(4+5) (right-associative)
			//question: why not make it almost all left-associative?
			//"+x" = "x+" = 0+x
			let pos = n.indexOf("+");
			if(pos >= 0) {
				return nullToDefault(parseNumber(n.slice(0, pos)), 0)
					+ nullToDefault(parseNumber(n.slice(pos + 1)), 0);
			}

			//subtraction: "3-4-5" -> (3-4)-5, not 3-(4-5) (left-associative)
			//"5-2+3" = (5-2)+3, not 5-(2+3)
			//"-x" = 0-x
			//"x-" = x-0
			pos = n.lastIndexOf("-");
			if(pos >= 0) {
				return nullToDefault(parseNumber(n.slice(0, pos)), 0)
					- nullToDefault(parseNumber(n.slice(pos + 1)), 0);
			}

			//multiplication: "3*4*5" -> 3*(4*5) (right-associative)
			//"*x" = "x*" = 1*x
			pos = n.indexOf("*");
			if(pos >= 0) {
				return nullToDefault(parseNumber(n.slice(0, pos)), 1)
					* nullToDefault(parseNumber(n.slice(pos + 1)), 1);
			}

			//division: "3/4/5" -> (3/4)/5, not 3/(4/5) (left-associative)
			//"5/2*3" = (5/2)*3, not 5/(2*3)
			//"/x" = 1/x
			//"x/" = x/1
			pos = n.lastIndexOf("/");
			if(pos >= 0) {
				return nullToDefault(parseNumber(n.slice(0, pos)), 1)
					/ nullToDefault(parseNumber(n.slice(pos + 1)), 1);
			}

			//exponentiation: "x^y^z" = x^(y^z) (right-associative)
			//"x^" = x^1
			//"^x" = 2^x (?)
			pos = n.indexOf("^");
			if(pos >= 0) {
				return nullToDefault(parseNumber(n.slice(0, pos)), 2)
					** nullToDefault(parseNumber(n.slice(pos + 1)), 1);
			}

			//to do: maybe support parentheses
			//	idea: use regular expressions matching last-level parenthesized text (without additional parentheses inside), and replace iteratively by values.
			return null;
		}
	}

	//a product
	let r = 1, i;
	//prime factor-based
	//to do: lisp-like (polish notation) array interpretation as s-expressions? (e.g. ["+", 12, 34, 56] -> 12 + 34 + 56)
	if(Array.isArray(n)) {
		for(i in n) {
			r *= Math.pow(primes[i], nullToDefault(parseNumber(n[i]), 0));
		}
		return r;
	}

	//objects with explicit factors
	for(i in n) {
		//even the factors can actually be complex things
		//1 as default base neutralizes unrecognized bases
		let iNum = nullToDefault(parseNumber(i), 1);
		if(isNaN(iNum)) continue;
		r *= Math.pow(iNum, nullToDefault(parseNumber(n[i]), 0));
	}
	return r;
}

//to do: ?line numbers in left side in code editors
//to do: ?caret position (row, column, char index) status label

//HTML elements
var elemNames = ["txtFreq", "txtTimeScale", "txtPatternCount", "txtPrimeCount", //generator parameters, common
	"txtRhythmScale", "txtRhythmFactors", //rhythm
	"txtVoiceCount", "txtReptCount", "txtReptPeriod", //generator parameters, additional
	"txtPlayFreqScale", "txtPlayVolScale", "txtPlayTimeScale", "txtPlayTimeDelta", //overall/playback controls
	"ctlFlatScript", "ctlStructuredScript", //code editors
	"btnFlattenStruct", "chkAutoFlatten", "btnPause", "chkAutoReload", "imgVisualizer", //other controls
	"outPrimeList", "outRhythmScales", "outAudioT", "outAudioDur", "outNoteCount", "outOscCount" //output fields
];
var expSpinners = ["txtFreq", "txtTimeScale", "txtPlayFreqScale", "txtPlayVolScale", "txtPlayTimeScale"];
var elems = {};
var autoFlatten = true;
const timeDisplPrecision = 2;

//look-up table to be used in an aspect of the volume envelope
var releaseCurve;
const releaseCurveSize = 512;

function docLoaded() {
	//load HTML element references
	for(let s of elemNames) {
		elems[s] = document.getElementById(s);
	}
	if(elems.chkAutoFlatten) elems.chkAutoFlatten.checked = autoFlatten;
	if(elems.outAudioT) elems.outAudioT.innerText = (0).toFixed(timeDisplPrecision);
	if(elems.outAudioDur) elems.outAudioDur.innerText = (0).toFixed(timeDisplPrecision);
	//to do: normalize() for ctlStructuredScript and ctlFlatScript?
	
	//initialize look-up table
	releaseCurve = new Float32Array(releaseCurveSize);
	for(let i = 0; i < releaseCurveSize; i++) {
		//opposite of growing exponential
		//releaseCurve[i] = 1 - Math.pow(2, 4 * (i / releaseCurveSize - 1));

		//parabolic
		releaseCurve[i] = 1 - (i / releaseCurveSize) ** 2;
	}
}

let textSize = 1;
function rescaleText(f) {
	textSize *= f;
	document.body.style.fontSize = textSize + "em";
}
function overflowToggle(control) {
	/*if(control.style.height == "auto") {
		control.style.height = "12em";
	} else {
		control.style.height = "auto";
	}*/
	control.classList.toggle("expanded");
}
function lineWrapToggle(control) {
	control.classList.toggle("lineWrapping");
}

function primeCountChanged() {
	primeCount = parseInt(elems.txtPrimeCount.value);
	if(primeCount < 2) primeCount = 2;
	if(elems.outPrimeList) elems.outPrimeList.innerText = "(" + primes.slice(0, primeCount).join(",") + ")";
}

//to do: force-allow arbitrary strings for "parseNumber" inputs. there must be an event for validation.
function expSpinnerChanged(event) {
	let elem = event.target;
	//let val = elem.valueAsNumber;
	let val = nullToDefault(parseNumber(elem.value), 1);
	let magnitude = Math.round(Math.log2(val)), step = 0.25 * 2 ** magnitude;
	elem.step = step;
	//if(elem == elems.txtFreq) {elem.min = val - 2 * step;}
	elem.min = val - 2 * step;
	elem.setCustomValidity("");
}
/*function textInvalid(event) { //not working
	event.target.setCustomValidity("");
	event.preventDefault();
	event.stopImmediatePropagation();
	//event.stopPropagation();
	return true;
}*/

var playFreqScale, playVolScale;
function playFreqScaleChanged() {
	let ctl = elems.txtPlayFreqScale;
	//if(ctl.valueAsNumber <= 0) ctl.stepUp();
	playFreqScale = nullToDefault(parseNumber(ctl.value), defaultBlockNode.freqRatio);
}
function playVolScaleChanged() {
	let ctl = elems.txtPlayVolScale;
	//if(ctl.valueAsNumber < 0) ctl.stepUp();
	playVolScale = nullToDefault(parseNumber(ctl.value), defaultBlockNode.volRatio);
}

//rhythm structure data (hierarchy of factors)
var rhythmFactors = [], rhythmFactorsAccum = [];
function rhythmAccumUpdate() {
	let factors = rhythmFactors.slice(); //array clone
	let product = 1;
	rhythmFactorsAccum = [];
	while(factors.length > 0) {
		product *= factors.pop();
		rhythmFactorsAccum.unshift(product);
	}
	if(elems.outRhythmScales) elems.outRhythmScales.innerText = rhythmFactorsAccum.join("/");
	//elems.outRhythmScales.innerText = rhythmFactorsAccum.slice(0, -1).join("/");
	rhythmFactors.push(1);
	rhythmFactorsAccum.push(1);
}
function rhythmFactorsChanged() {
	//to do: support sums (e.g. 3 beats + 4 beats -> 1001000)?
	//to do: support fractions (e.g. 5/2 beats)?
	//to do: support parentheses?
	let s = elems.txtRhythmFactors.value.toString(); //text
	rhythmFactors = s.split("*").map(x => parseFloat(x)); //array of numbers
	if(rhythmFactors.some(x => isNaN(x))) {
		rhythmFactors = [2, 2, 2]; //not a number? default/fallback
		//question: choose a different default?
		if(elems.txtRhythmFactors) elems.txtRhythmFactors.setCustomValidity("Invalid rhythm formula.");
	} else {
		if(elems.txtRhythmFactors) elems.txtRhythmFactors.setCustomValidity("");
	}
	rhythmAccumUpdate();
}

function deletePrevTab() {
	//outdent line (actually, the nearest tab before caret)
	let rng = getSelection().getRangeAt(0); //disregarding multiple selection, which only Firefox supports
	let pos = rng.endOffset;
	let node = rng.endContainer; //to do: store original node?
	let txt = node.textContent;
	let i;

	while(true) {
		i = txt.lastIndexOf("\t", pos - 1);
		if(txt.slice(i, pos).indexOf("\n") >= 0) return; //line breaks interrupt the search
		if(i >= 0) break; //tab character found?

		node = node.previousSibling;
		if(!node) return; //end of line?
		if(node.nodeName.toUpperCase() == "BR") return; //line break attacks again
		
		txt = node.textContent;
		pos = txt.length;
	}
	if(!(i >= 0)) return;

	//tried to preserve caret position, but the result is buggy
	/*txtBefore = txtBefore.slice(0, i) + txtBefore.slice(i + 1);
	node.textContent = txtBefore + txt.slice(pos);*/
	/*rng.setStart(node, pos - 1);
	rng.setEnd(node, pos - 1);*/

	rng.setStart(node, i);
	rng.setEnd(node, i + 1);
	//rng.deleteContents();
	document.execCommand("delete", false, null);
	rng.setStart(node, pos - 1); //also buggy
	rng.setEnd(node, pos - 1);
}
function editorKeyDown(event) {
	if(event.key == "Tab") {
		//console.log(event);
		event.stopPropagation();
		event.preventDefault();

		//tried to dispatch input or beforeinput events. didn't work.
		//event.target.dispatchEvent(new InputEvent("beforeinput", {data: "\t", inputType: "insertText"}));

		event.target.focus(); //unnecessary?
		if(event.shiftKey) {
			deletePrevTab();
		} else {
			document.execCommand("insertText", false, "\t");
		}
	}
}
function editorInput(event) {
	event.target.style.backgroundColor = "";
}
