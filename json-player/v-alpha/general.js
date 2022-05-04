//to do: check performance difference of strict mode?
"use strict";

//to do: consider worker threads
//to do: ?line numbers in left side in code editors
//to do: ?caret position (row, column, char index) status label
//to do: (structured) music file upload to page
//to do: return true more often? (in this case, start by finding "return false" occurrences)
//to do: consider radically changing flattened format: events (more like midi), supporting named notes

//to do: add note release extra time? (so that duration may affect nonspecified next noteStart, but release won't)
const defaultBlockNode = {
	//question: these names are probably lousy and inconsistent. right now i'm not sure of how to improve.
	timeDelta: 0,
	timeScale: 1,

	freqRatio: 1,
	volRatio: 1,

	timbre: "sine",
	decayFactor: 256, //question: rename this to sustain(Factor)?
	attack: 1 / 64,

	//portamento: 1 / 64,
	portamento: 0,
	vibratoFreq: 2 ** 18 / 86400,
	//vibratoDepth: 1 / 8,
	vibratoDepth: 0,
	vibratoAttack: 3
}, relativeBlockProps = ["timeDelta", "timeScale", "freqRatio", "volRatio"],
 substitutiveProps = ["timbre", "decayFactor", "attack", "portamento", "vibratoFreq", "vibratoDepth", "vibratoAttack"];
const defaultNoteNode = {
	noteStart: 0, //seconds
	duration: 1, //seconds

	freq: defaultBlockNode.freqRatio, //Hertz
	vol: defaultBlockNode.volRatio, //negative volumes are supported in the player, and apparently result in phase inversion.

	timbre: defaultBlockNode.timbre,
	decayFactor: defaultBlockNode.decayFactor, //seconds
	attack: defaultBlockNode.attack, //seconds

	portamento: defaultBlockNode.portamento, //seconds
	vibratoFreq: defaultBlockNode.vibratoFreq, //Hertz
	vibratoDepth: defaultBlockNode.vibratoDepth, //octaves or bits
	vibratoAttack: defaultBlockNode.vibratoAttack //seconds
}, incrementalNoteProps = ["noteStart", "duration", "noteStop", "freq0", "freq", "vol"],
tonalOnlyProps = ["portamento", "vibratoFreq", "vibratoDepth", "vibratoAttack"];

//of course there are infinite primes, but these are more than enough.
var primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47], primeCount = 2, expVariance = 2;

function NaNToDefault(x, def) {
	return isNaN(x) ? def : x;
}
//try to evaluate parenthesized subexpressions
function exprEliminateParens(str) {
	//use regular expressions matching last-level parenthesized text (without additional parentheses inside), and replace iteratively by values
	//warning: this is a string-to-string operation, where numbers become decimal-to-binary-to-decimal coded
	let re = new RegExp(/\(([^\(\)]*)\)/, "g");
	do {
		let s = str.replace(re, (match, p1, offset, string) => parseNumber(p1).toString());
		if(s == str) break;
		str = s;
	} while(true);
	return str;
}
//recursive function
function parseNumber(n) {
	//remember: continuation after return => else
	if(arguments.length < 1) return undefined; //unspecific
	if(n === undefined) return undefined;
	if(n === null) return NaN; //more specific
	let t = typeof(n);

	//simpler attempts first.
	if((t === "number") || (t === "bigint")) return n;
	if(t === "function") return parseNumber(n()); //?

	if(Array.isArray(n)) {
		//a product, prime factor-based
		let r = 1, i;
		//to do: lisp-like (polish notation) array interpretation as s-expressions? (e.g. ["+", 12, 34, 56] -> 12 + 34 + 56)
		for(i in n) {
			r *= Math.pow(primes[i], NaNToDefault(parseNumber(n[i]), 0));
		}
		return r;
	}

	//try conversion to number
	//note: JavaScript converts Number([]) to 0; that's why array detection comes earlier
	//JavaScript converts Number("") to 0; let's try to prevent this
	if((t !== "string") || (n.length != 0)) {
		let ret = Number(n);
		if(!isNaN(ret)) return ret;
	}

	if(t === "string") {
		if(n.length == 0) return NaN;
		
		try {
			//can be an object
			n = JSON.parse(n);
		} catch (error) {
			//can be an expression

			n = exprEliminateParens(n);

			//operators, starting from low precedence
			//addition: "3+4+5" -> 3+(4+5) (right-associative)
			//question: why not make it almost all left-associative?
			//"+x" = "x+" = 0+x
			let pos = n.indexOf("+");
			if(pos >= 0)
				return NaNToDefault(parseNumber(n.slice(0, pos)), 0)
					+ NaNToDefault(parseNumber(n.slice(pos + 1)), 0);

			//subtraction: "3-4-5" -> (3-4)-5, not 3-(4-5) (left-associative)
			//"5-2+3" = (5-2)+3, not 5-(2+3)
			//"-x" = 0-x
			//"x-" = x-0
			pos = n.lastIndexOf("-");
			if(pos >= 0)
				return NaNToDefault(parseNumber(n.slice(0, pos)), 0)
					- NaNToDefault(parseNumber(n.slice(pos + 1)), 0);

			//multiplication: "3*4*5" -> 3*(4*5) (right-associative)
			//"*x" = "x*" = 1*x
			pos = n.indexOf("*");
			if(pos >= 0)
				return NaNToDefault(parseNumber(n.slice(0, pos)), 1)
					* NaNToDefault(parseNumber(n.slice(pos + 1)), 1);

			//division: "3/4/5" -> (3/4)/5, not 3/(4/5) (left-associative)
			//"5/2*3" = (5/2)*3, not 5/(2*3)
			//"/x" = 1/x
			//"x/" = x/1
			pos = n.lastIndexOf("/");
			if(pos >= 0)
				return NaNToDefault(parseNumber(n.slice(0, pos)), 1)
					/ NaNToDefault(parseNumber(n.slice(pos + 1)), 1);

			//exponentiation: "x^y^z" = x^(y^z) (right-associative)
			//"x^" = x^1
			//"^x" = 2^x (?)
			pos = n.indexOf("^");
			if(pos >= 0)
				return NaNToDefault(parseNumber(n.slice(0, pos)), 2)
					** NaNToDefault(parseNumber(n.slice(pos + 1)), 1);

			//no operation? try Number() again (may yield NaN).
			return Number(n);
		}
	}

	//a product (object with explicit factors)
	if(t === "object") {
		let r = 1, i;
		for(i in n) {
			//1 as default base neutralizes unrecognized bases
			//to do: probably there are objects that shouldn't be boiled down straight into numbers. names that can't become numbers may be a sign of that.
			let iNum = NaNToDefault(parseNumber(i), 1); //even the factors can actually be complex things
			if(isNaN(iNum)) continue;
			r *= Math.pow(iNum, NaNToDefault(parseNumber(n[i]), 0));
		}
		return r;
	}

	return NaN;
}

//HTML elements
const elemNames = ["txtBaseFreq", "txtTimeScale", "txtPatternCount", "txtPrimeCount", "txtExpVariance", //generator parameters, common
	"txtRhythmScale", "txtRhythmFactors", //rhythm
	"txtVoiceCount", "txtReptCount", "txtReptPeriod", //generator parameters, additional
	"txtPlayFreqScale", "txtPlayVolScale", "txtPlayTimeScale", "txtPlayTimeDelta", //overall/playback controls
	"ctlFlatScript", "ctlStructuredScript", //code editors
	"btnFlattenStruct", "chkAutoFlatten", "btnPause", "chkAutoReload", "aStructDownload", "imgVisualizer", "aAudioDownload", //other controls
	"outToolTip", "outPrimeList", "outRhythmScales", "outAudioT", "outAudioDur", "outNoteCount", "outGenCount", "outExportDuration", "outExportProgress" //output fields
];
const expSpinners = ["txtBaseFreq", "txtTimeScale", "txtPlayFreqScale", "txtPlayVolScale", "txtPlayTimeScale"];
var elems = {};
var autoFlatten = true;
const timeDisplPrecision = 2;

//look-up table to be used in an aspect of the volume envelope
var releaseCurve;
const releaseCurveSize = 2048;

//variability per prime factor (2, 3, 5, 7, ...)
let maxPitches = null;

function docLoaded() {
	//load HTML element references
	for(let s of elemNames) {
		elems[s] = document.getElementById(s);
	}
	if(elems.chkAutoFlatten) elems.chkAutoFlatten.checked = autoFlatten;
	if(elems.outAudioT) elems.outAudioT.innerText = (0).toFixed(timeDisplPrecision);
	if(elems.outAudioDur) elems.outAudioDur.innerText = (0).toFixed(timeDisplPrecision);
	//to do: normalize() for ctlStructuredScript and ctlFlatScript?
	
	//build table of exponent variance per prime factor (tonality limitation: high factors are too odd, and should have low exponents)
	//question: too simple? should it depend on primeCount? should it have an extra parameter of overall variance scale?
	maxPitches = new Array(primes.length);
	for(const i in primes)
		maxPitches[i] = 1 / Math.log2(primes[i]);

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
	if(!document || !document.body || !document.body.style) return false;
	textSize *= f;
	//document.body.style.fontSize = textSize + "em";
	document.children[0].style.fontSize = textSize + "em";
}
function overflowToggle(control) {
	if(!control) return false;
	control.classList.toggle("expanded");
}
function lineWrapToggle(control) {
	if(!control) return false;
	control.classList.toggle("lineWrapping");
}

function primeCountChanged() {
	if(!elems.txtPrimeCount) return false;
	primeCount = NaNToDefault(parseNumber(elems.txtPrimeCount.value), 2);
	if(primeCount < 2) primeCount = 2;
	if(elems.outPrimeList) elems.outPrimeList.innerText = "(" + primes.slice(0, primeCount).join(",") + ")";
}

//to do: force-allow arbitrary strings for "parseNumber" inputs by using type="text".
function expSpinnerChanged(event) {
	let elem = event.target;
	if(!elem) return false;
	//let val = elem.valueAsNumber;
	let val = parseNumber(elem.value);
	if(isNaN(val)) {
		val = 1;
		elem.classList.add("invalid");
		elem.setCustomValidity("Input not recognized as a real number.");
	} else {
		elem.classList.remove("invalid");
		elem.setCustomValidity("");
	}
	let magnitude = Math.round(Math.log2(Math.abs(val))), step = 0.25 * 2 ** magnitude;
	elem.step = step;
	//if(elem == elems.txtBaseFreq) {elem.min = val - 2 * step;}
	elem.min = val - 2 * Math.sign(val) * step;
	//elem.reportValidity();
}
/*function textInvalid(event) { //not working for input type="number"
	event.target.setCustomValidity("");
	event.preventDefault();
	event.stopImmediatePropagation();
	//event.stopPropagation();
	return true;
}*/

const defaultRootFreq = 440;
var rootFreq = defaultRootFreq, playFreqScale = 1, playVolScale = 1;
function baseFreqChanged() {
	let ctl = elems.txtBaseFreq;
	if(!ctl) return false;
	rootFreq = parseNumber(ctl.value);
	if(!rootFreq) {
		ctl.classList.add("invalid");
		ctl.setCustomValidity("Base frequency shouldn't be 0.");
		rootFreq = defaultRootFreq;
	} else {
		ctl.classList.remove("invalid");
		ctl.setCustomValidity("");
	}
}
function playFreqScaleChanged() {
	let ctl = elems.txtPlayFreqScale;
	if(!ctl) return false;
	//if(ctl.valueAsNumber <= 0) ctl.stepUp();
	playFreqScale = NaNToDefault(parseNumber(ctl.value), defaultBlockNode.freqRatio);
	if(playerClip) playerClip.playFreqScale = playFreqScale;
}
function playVolScaleChanged() {
	let ctl = elems.txtPlayVolScale;
	if(!ctl) return false;
	//if(ctl.valueAsNumber < 0) ctl.stepUp();
	playVolScale = NaNToDefault(parseNumber(ctl.value), defaultBlockNode.volRatio);
	if(playerClip) playerClip.playVolScale = playVolScale;
}

//rhythm structure data (hierarchy of factors)
var rhythmFactors = [], rhythmFactorsAccum = [];
function rhythmAccumUpdate() {
	if(!rhythmFactors) rhythmFactors = [];
	let factors = rhythmFactors.slice(); //array clone
	let product = 1;
	rhythmFactorsAccum = [1];
	while(factors.length > 0) {
		product *= factors.pop(); //reverse traversal
		rhythmFactorsAccum.unshift(product); //add as first
	}
	//rhythmFactorsAccum.push(1);
	if(elems.outRhythmScales) elems.outRhythmScales.innerText = rhythmFactorsAccum.join("/");
	rhythmFactors.push(1);
}
function rhythmFactorsChanged() {
	//to do: support additive time signatures (e.g. 3 beats + 4 beats -> 1001000)? (would probably turn rhythmFactors into a tree)
	//  to do: how should we interpret a heterogeneous number of factors, e.g. 3 + 3*2 (top-down vs. bottom-up)? like (2 + 2 + 2) + ((1 + 1) + (1 + 1) + (1 + 1)) or (1 + 1 + 1) + ((1 + 1) + (1 + 1) + (1 + 1))?
	//to do: support rational numbers (e.g. 4/3 beats) without reducing to floats?
	if(!elems.txtRhythmFactors) return false;
	let s = elems.txtRhythmFactors.value.toString(); //text
	rhythmFactors = []; //will become an array of numbers
	if(s.length >= 1) {
		s = exprEliminateParens(s).split("*"); //multiplications inside parens won't be parsed as rhythmic levels
		//rhythmFactors = s.map(x => parseFloat(x)); //array of numbers
		for (const n of s) {
			//expand powers (e.g. 2^3 -> 2*2*2 -> [2, 2, 2], not [8])
			let pos = n.indexOf("^");
			if(pos >= 0) {
				let base = NaNToDefault(parseNumber(n.slice(0, pos)), 2);
				for (let exp = NaNToDefault(parseNumber(n.slice(pos + 1)), 1); exp >= 1; exp--)
					rhythmFactors.push(base);
				//question: non-integer exponents? (if(exp > 0) ...)
			} else
				rhythmFactors.push((n.length < 1) ? 1 : parseNumber(n));
		}
	}
	//to do: invalidate factors below 1? and negative factors?
	//note: empty structures now allowed
	try {
		if(rhythmFactors.some(x => x == 0)) //has zeroes?
			throw "Rhythm factors can't include zero.";
		
		if(rhythmFactors.some(x => isNaN(x))) //unparsed expressions?
			throw "Unrecognized numerical expression in rhythm formula.";

		elems.txtRhythmFactors.classList.remove("invalid");
		elems.txtRhythmFactors.setCustomValidity("");
	} catch(error) {
		//default/fallback
		rhythmFactors = [2, 2, 2]; //question: choose a different default? (perhaps based on primeCount)
		elems.txtRhythmFactors.classList.add("invalid");
		elems.txtRhythmFactors.setCustomValidity(error.toString());
	}
	rhythmAccumUpdate();
}

function deletePrevTab() {
	//outdent line (actually, erase the nearest tab before caret)
	let rng = getSelection().getRangeAt(0); //disregarding multiple selection, which only Firefox supports
	let pos = rng.endOffset;
	let node = rng.endContainer; //to do: store original node?
	let txt = node.textContent;
	let i;

	while(true) {
		i = txt.lastIndexOf("\t", pos - 1);
		if(txt.slice(i, pos).indexOf("\n") >= 0) return false; //line breaks interrupt the search
		if(i >= 0) break; //tab character found?

		node = node.previousSibling;
		if(!node) return false; //"end" of text?
		if(node.nodeName.toUpperCase() == "BR") return false; //line break attacks again
		
		txt = node.textContent;
		pos = txt.length;
	}
	if(!(i >= 0)) return false;

	//tried to preserve caret position, but the result is buggy
	/*txtBefore = txtBefore.slice(0, i) + txtBefore.slice(i + 1);
	node.textContent = txtBefore + txt.slice(pos);*/
	/*rng.setStart(node, pos - 1);
	rng.setEnd(node, pos - 1);*/

	rng.setStart(node, i);
	rng.setEnd(node, i + 1);
	//rng.deleteContents();
	document.execCommand("delete", false, null); //they say execCommand() is deprecated. currently i haven't found any proper replacement for this command.
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
	//to do: home key goes past initial indentation?
}
function editorInput(event) {
	if(!event || !event.target || !event.target.classList) return false;
	event.target.classList.remove("invalid");
}
function recalcEditorCursorPos(event) { //not working, at least in Ffx
	let elem = event.target;
	if(!elem) return false;
	elem.normalize();
	
	let rng = getSelection().getRangeAt(0); //disregarding multiple selection, which only Firefox supports
	if(!rng) return false;
	let pos = rng.endOffset;
	let node = rng.endContainer;
	let txt = node.textContent;
	
	let i, count = 1;
	//let iArr = [];
	while(true) {
		if(!txt || !(txt.length >= 1) || !(pos > 0))
			i = -1;
		else
			i = txt.lastIndexOf("\n", pos - 1);
		if(i >= 0) {
			count++; //character found
			//iArr.push(i);
			pos = i;
		} else {
			node = node.previousSibling;
			if(!node || !elem.contains(node)) break; //"end" of text?
			if(node.nodeName.toUpperCase() == "BR") count++; //line break attacks again
			//if(node.tagName.toUpperCase() == "BR") count++; //line break attacks again
			//iArr.push(node.nodeName);

			txt = node.textContent;
			pos = txt.length;
			//iArr.push(pos);
		}
	}
	document.title = count.toString();
	//document.title = iArr.toString();
}

const focusableElemTypes = ["INPUT", "BUTTON"];
function setToolTip(event) {
	if(!elems.outToolTip) return false;
	let elem = event.target;
	if(!elem) return false;
	if(focusableElemTypes.includes(elem.tagName.toUpperCase()) && (document.activeElement != elem)) return false; //could have focus -> should have focus

	let sentences = [];
	let description = elem.title;
	if((typeof(description) === "string") && (description.length > 0))
		sentences.push(description);

	description = elem.validationMessage;
	if((typeof(description) === "string") && (description.length > 0))
		sentences.push(description);

	if(sentences.length > 0) {
		//elems.outToolTip.innerText = sentences.join(" ");
		elems.outToolTip.innerHTML = sentences.join("<br />");
		elems.outToolTip.style.position = "sticky";
	}
}

let lastCodeObjURL = null;
function getDateTimeCode(size) {
	if(size < 1) return "";
	let now = new Date();
	let dArr = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()];
	if(size < 7) dArr.length = size;
	let dPadding = [4, 2, 2, 2, 2, 2, 3];
	for(let i in dArr)
		dArr[i] = dArr[i].toString().padStart(dPadding[i], "0");
	return dArr.join("-");
}
function structDownload(event) {
	if(!elems.ctlStructuredScript) return false;
	//based on code from https://stackoverflow.com/questions/2897619/using-html5-javascript-to-generate-and-save-a-file
	let data = [elems.ctlStructuredScript.innerText];
	let file;
	let properties = {type: 'application/json'}; //constructor parameters: file's MIME-type.
	
	//date for file name
	let fileName = getDateTimeCode(5) + ".mus.json";
	
	try {
		//specify the filename using the File constructor, but...
		file = new File(data, fileName, properties);
	} catch(error) {
		//...fall back to the Blob constructor if that isn't supported.
		file = new Blob(data, properties);
	}
	if(lastCodeObjURL) URL.revokeObjectURL(lastCodeObjURL);
	lastCodeObjURL = URL.createObjectURL(file);
	
	if(!elems.aStructDownload) return false;
	elems.aStructDownload.setAttribute('href', lastCodeObjURL);
	elems.aStructDownload.setAttribute('download', fileName);
	
	/*let newEvent = new MouseEvent('click');
	elems.aStructDownload.dispatchEvent(newEvent);*/
	elems.aStructDownload.click();
	return true;
}
