"use strict";

//to do: put some project-neutral scripts (e.g. parseNumber) in a "shared" file
//to do: consider extra .js file for user interface
//to do: return true more often? (in this case, start by finding "return false" occurrences)
//to do: !more console reports and exception handling (success and failure of many operations)
//to do: !consider worker threads or scheduler
//to do: code editors:
//to do: 	?line numbers in left side in code editors
//to do: 	?caret position (row, column, char index) status label
//to do: !consider radically changing flattened format: events (more like midi), supporting named notes
//to do: multitrack architecture for mixing and effect pipelines, with named tracks
//to do: ...take query parameters (e.g. ?baseFreq=512&makeMelody)
//to do: 	commands to generate, play, reset preferences
//to do: 	take urls to import .mus.json files
//to do: revise and remove excess dead code
//to do: !(hierarchical) objects for preferences and default preferences
//to do: I think it will be good to put return's even in events
//to do: try more use of promise.then for heavy code, hopefully improving UI performance

//to do: !add note release extra time? (so that duration may affect nonspecified next noteStart, but release won't)
const defaultBlockNode = {
	//question: these names are probably lousy and inconsistent. right now I'm not sure of how to improve.
	timeDelta: 0,
	timeScale: 1,

	freqRatio: 1,
	volRatio: 1,

	timbre: "sine",
	q: 0, //for noise resonance. question: substitutive or relative? (currently substitutive)
	decayFactor: 256, //question: rename this to sustain(Factor)?
	attack: 1 / 64,

	//portamento: 1 / 64,
	portamento: 0,
	vibratoFreq: 2 ** 18 / 86400,
	//vibratoDepth: 1 / 8,
	vibratoDepth: 0,
	vibratoAttack: 3,

	remark: "", //one-time comment; currently unprocessed altogether.
	tag: "" //inherited (substitutive) comment; currently unprocessed altogether.
	//to do: show these last two in the visualizer (probably as horizontal lines)
}, relativeBlockProps = ["timeDelta", "timeScale", "freqRatio", "volRatio"],
 substitutiveProps = ["timbre", "q", "decayFactor", "attack", "portamento", "vibratoFreq", "vibratoDepth", "vibratoAttack", "tag"]; //currently unused.
const defaultNoteNode = {
	noteStart: 0, //seconds
	duration: 1, //seconds

	freq: defaultBlockNode.freqRatio, //Hertz
	vol: defaultBlockNode.volRatio, //negative volumes are supported in the player, and apparently result in phase inversion.

	timbre: defaultBlockNode.timbre,
	q: defaultBlockNode.q,
	decayFactor: defaultBlockNode.decayFactor, //seconds
	attack: defaultBlockNode.attack, //seconds

	portamento: defaultBlockNode.portamento, //seconds
	vibratoFreq: defaultBlockNode.vibratoFreq, //Hertz
	vibratoDepth: defaultBlockNode.vibratoDepth, //octaves or bits
	vibratoAttack: defaultBlockNode.vibratoAttack, //seconds

	remark: defaultBlockNode.remark,
	tag: defaultBlockNode.tag
}, incrementalNoteProps = ["noteStart", "duration", "noteStop", "freq0", "freq", "vol"],
tonalOnlyProps = ["portamento", "vibratoFreq", "vibratoDepth", "vibratoAttack"]; //to do: noise-only properties?

//of course there are infinite primes, but these are more than enough.
var primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

function NaNToDefault(x, def) {
	//note: for non-numbers, isNaN returns whether they can be converted to numbers (e.g. "9" vs. "abc")
	//to do: !check every use of NaNToDefault considering the above
	return isNaN(x) ? def : x;
}
//try to evaluate parenthesized subexpressions
function exprEliminateParens(str) {
	//use regular expressions matching last-level parenthesized text (without additional parentheses inside), and replace iteratively by values
	//warning: this is a string-to-string operation, where numbers become decimal-to-binary-to-decimal coded
	const re = new RegExp(/\(([^\(\)]*)\)/, "g");
	do {
		const s = str.replace(re, (match, p1, offset, string) => parseNumber(p1).toString());
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
	const t = typeof(n);

	//simpler attempts first.
	if(t === "number" || t === "bigint") return n;
	if(t === "function") return parseNumber(n()); //?

	if(Array.isArray(n)) {
		//a product, prime factor-based
		let r = 1;
		//to do: lisp-like (polish notation) array interpretation as s-expressions? (e.g. ["+", 12, 34, 56] -> 12 + 34 + 56)
		for(const i in n)
			r *= Math.pow(primes[i], NaNToDefault(parseNumber(n[i]), 0));
		return r;
	}

	//try conversion to number
	//note: JavaScript converts Number([]) to 0; that's why array detection comes earlier
	//JavaScript converts Number("") to 0; let's try to prevent this
	if(t !== "string" || n.length != 0) {
		const ret = Number(n);
		if(!isNaN(ret)) return ret;
	}

	if(t === "string") {
		if(n.length == 0) return NaN;

		try { //can be an object
			n = JSON.parse(n);
		} catch(error) { //can be an expression
			n = exprEliminateParens(n);

			//operators, starting from low precedence (higher-precedence ones in the way will be captured in recursive calls)
			const slicer = pos => (pos >= 0 ? [parseNumber(n.slice(0, pos)), parseNumber(n.slice(pos + 1))] : false);
			let slices;

			//addition: "3+4+5" -> 3+(4+5) (right-associative)
			//question: why not make it almost all left-associative?
			//"+x" = "x+" = 0+x
			if(slices = slicer(n.indexOf("+")))
				return NaNToDefault(slices[0], 0) + NaNToDefault(slices[1], 0);

			//subtraction: "3-4-5" -> (3-4)-5, not 3-(4-5) (left-associative)
			//"5-2+3" = (5-2)+3, not 5-(2+3)
			//"-x" = 0-x
			//"x-" = x-0
			if(slices = slicer(n.lastIndexOf("-")))
				return NaNToDefault(slices[0], 0) - NaNToDefault(slices[1], 0);

			//multiplication: "3*4*5" -> 3*(4*5) (right-associative)
			//"*x" = "x*" = 1*x
			if(slices = slicer(n.indexOf("*")))
				return NaNToDefault(slices[0], 1) * NaNToDefault(slices[1], 1);

			//division: "3/4/5" -> (3/4)/5, not 3/(4/5) (left-associative)
			//"5/2*3" = (5/2)*3, not 5/(2*3)
			//"/x" = 1/x
			//"x/" = x/1
			if(slices = slicer(n.lastIndexOf("/")))
				return NaNToDefault(slices[0], 1) / NaNToDefault(slices[1], 1);

			//exponentiation: "x^y^z" = x^(y^z) (right-associative)
			//"x^" = x^1
			//"^x" = 2^x (? question)
			if(slices = slicer(n.indexOf("^")))
				return NaNToDefault(slices[0], 2) ** NaNToDefault(slices[1], 1);

			//no operation? try Number() again (may yield NaN).
			return Number(n);
		}
	}

	//a product (object with explicit factors)
	if(t === "object") {
		let r = 1;
		for(const i in n) {
			//1 as default base neutralizes unrecognized bases
			//to do: probably there are objects that shouldn't be boiled down straight into numbers. names that can't become numbers may be a sign of that.
			const iNum = NaNToDefault(parseNumber(i), 1); //even the factors can actually be complex things
			if(isNaN(iNum)) continue;
			r *= Math.pow(iNum, NaNToDefault(parseNumber(n[i]), 0));
		}
		return r;
	}

	return NaN;
}
function toFixedTrunc(value, digits) {
	if(!digits) return value.toFixed(digits);
	const scale = Math.pow(10, digits);
	return (Math.trunc(scale * value) / scale).toFixed(digits);
}
function codeEditorContentGet(elem) {
	if(!elem) {
		console.info("codeEditorContentGet(): parameter elem is empty. Returning.");
		return false;
	}
	if(["INPUT", "TEXTAREA"].includes(elem.tagName.toUpperCase()))
		return elem.value;
	else
		return elem.textContent;
}
function codeEditorContentSet(elem, text) {
	if(!elem) {
		console.info("codeEditorContentSet(): parameter elem is empty. Returning.");
		return false;
	}
	try {
		if(["INPUT", "TEXTAREA"].includes(elem.tagName.toUpperCase()))
			elem.value = text;
		else
			elem.textContent = text;
	} catch (error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to set code box contents. " + (error.message ?? error ?? ""), 3);
	}
	return true;
}

const timeDisplPrecision = 2;

//look-up table to be used in an aspect of the volume envelope
var releaseCurve;
const releaseCurveSize = 8192;

//variability per prime factor (2, 3, 5, 7, ...); array of array of numbers.
var primeExpRanges = null;

async function initialCalculations() {
	//initialize look-up table
	releaseCurve = new Float32Array(releaseCurveSize);
	for(let i = 0; i < releaseCurveSize; i++) {
		//opposite of growing exponential
		//releaseCurve[i] = 1 - Math.pow(2, 4 * (i / releaseCurveSize - 1));

		//parabolic
		releaseCurve[i] = 1 - (i / releaseCurveSize) ** 2;
	}
}
function loadEventHandlers() {
	for(const elem of document.querySelectorAll("input.exp")) {
		elem.addEventListener("input", expSpinnerChanged);
		//elem.addEventListener("invalid", expSpinnerInvalid);
	}

	btnTextShrink.addEventListener("click", rescaleText);
	btnTextEnlarge.addEventListener("click", rescaleText);
	//cboPageTheme.addEventListener("click", themeChanged); //click only works via mouse. doesn't work well in G. Chrome.
	//cboPageTheme.addEventListener("focus", themeChanged); //doesn't work well in G. Chrome.
	cboPageTheme.addEventListener("input", themeChanged); //working: change, input. inappropriate: toggle, select, selectionchange.
	btnHueFine1.addEventListener("click", btnHueClick);
	btnHueFine2.addEventListener("click", btnHueClick);

	txtBaseFreq.addEventListener("input", baseFreqChanged);
	txtPrimeCount.addEventListener("input", primeCountChanged);
	txtExpVariance.addEventListener("input", expVarianceChanged);
	ctlPrimeExpRanges.addEventListener("input", parseExpRanges);

	btnRhythmFactorsGen.addEventListener("click", btnRhythmFactorsGenClick);
	txtRhythmFactors.addEventListener("input", rhythmFactorsChanged);

	btnChordGen.addEventListener("click", btnChordGenClick);
	btnRhythmGen.addEventListener("click", btnRhythmGenClick);
	btnMelodyGen.addEventListener("click", btnMelodyGenClick);

	inFile.addEventListener("change", inFileChange);
	//inFile.addEventListener("input", inFileChange);
	btnStructImport.addEventListener("click", btnStructImportClick);
	btnStructDownload.addEventListener("click", structDownload);
	//btnOverflowToggle1.addEventListener("click", overflowToggle);
	//btnLineWrapToggle1.addEventListener("click", lineWrapToggle);
	chkOverflow1.addEventListener("click", overflowToggle);
	chkLineWrap1.addEventListener("click", lineWrapToggle);
	ctlStructuredScript.addEventListener("input", scriptChanged);

	btnFlattenStruct.addEventListener("click", flattenStruct);
	chkAutoFlatten.addEventListener("click", event => setAutoFlatten(chkAutoFlatten.checked));
	//btnOverflowToggle2.addEventListener("click", overflowToggle);
	//btnLineWrapToggle2.addEventListener("click", lineWrapToggle);
	chkOverflow2.addEventListener("click", overflowToggle);
	chkLineWrap2.addEventListener("click", lineWrapToggle);
	ctlFlatScript.addEventListener("input", codeEditorResetValidity); //question: also for ctlStructuredScript? (currently no)

	txtPlayFreqScale.addEventListener("input", playFreqScaleChanged);
	txtPlayVolScale.addEventListener("input", playVolScaleChanged);

	btnPlay.addEventListener("click", loadAndPlay);
	btnPause.addEventListener("click", pauseToggle);
	btnStop.addEventListener("click", btnStopClick);

	btnAudioExport.addEventListener("click", audioExport);
	btnAudioExportCancel.addEventListener("click", audioExportCancel);

	btnResetPreferences.addEventListener("click", btnResetPreferencesClick);

	for(const elem of document.querySelectorAll("[data-pref]"))
		elem.addEventListener("input", saveInputValue);

	for(const elem of document.getElementsByClassName("code-editor")) {
		elem.addEventListener("keydown", editorKeyDown);
		elem.addEventListener("paste", editorPaste);
		//elem.addEventListener("input", editorChanged);
		//elem.addEventListener("keyup", recalcEditorCursorPos);
		//elem.addEventListener("click", recalcEditorCursorPos);
	}
	//window.addEventListener("paste", editorPaste);

	{
		const main1 = document.getElementsByTagName("main")[0]; //limited scope and life-time declaration
		main1.addEventListener("dragover", mainDragOver);
		main1.addEventListener("drop", mainDrop);
	}
}
function addControlSeparators() {
	console.log("addControlSeparators(): function started...");
	//control separators
	//for(const s of document.querySelectorAll('.cell:not(:first-of-type)')) {
	for(const s of document.querySelectorAll(':nth-child(n + 2 of .cell)')) {
		const separator = document.createElement("span");
		separator.classList.add("separator");

		//s.parentElement.insertBefore(separator, s);
		//s.insertBefore(separator, s.firstElementChild);
		//remove unwanted white space that could affect spacing
		const first = s.firstChild;
		if(first.nodeType == Node.TEXT_NODE && first.nodeValue.trim() == "")
			s.removeChild(first);
		s.insertBefore(separator, s.firstChild);
		//s.prepend(separator, "\u{A0}");
	}
	console.log("addControlSeparators(): function ending");
}
//to do: rigorous review of load routine order
function pageLoaded(event) {
	//load HTML element references (renders document.getElementById unnecessary)
	for(const s of document.querySelectorAll('[id]'))
		window[s.id] = s;

	//if(window.chkAutoFlatten) chkAutoFlatten.checked = autoFlatten;
	if(window.outAudioT) outAudioT.innerText = toFixedTrunc(0, timeDisplPrecision);
	if(window.outAudioDur) outAudioDur.innerText = toFixedTrunc(0, timeDisplPrecision);
	if(window.txtPrimeCount) txtPrimeCount.max = primes.length.toString();
	//to do: normalize() for ctlStructuredScript and ctlFlatScript?

	initialCalculations();

	codeEditorContentSet(ctlStructuredScript, defStructuredCode);
	codeEditorContentSet(ctlFlatScript, defFlattenedCode);

	Promise.resolve().then(addControlSeparators)/* ?.catch?.(reason => {
			window.reportError(reason);
		}) */;

	Promise.resolve().then(addIntervalSamples)/* ?.catch?.(reason => {
			window.reportError(reason);
		}) */;

	console.log("pageLoaded(): function ending");
}
function pageReady(event) {
	Promise.resolve().then(value => {
			console.log("pageReady() promise: function started...");
			loadEventHandlers();
			window.loadPreferences?.(); //preferences.js
			adjustingPreferences = true;
			try {
				const evt = new Event("input");
				for(const elem of document.querySelectorAll("input.exp"))
					elem.dispatchEvent(evt);
				window.primeCountChanged?.();
			} finally {
				adjustingPreferences = false;
			}
			addToolTipHandler("body>main", event => updateCtlToolTip(event, outToolTip));
			addToolTipHandler("#tblFractionIntervals", event => updateCtlToolTip(event, outToolTipIntervals));
			window.rhythmFactorsChanged?.();

			window.initSpinControls?.(); //custom-spin.js
			for(let s of document.querySelectorAll('label[for]'))
				//s.title = document.getElementById(s.htmlFor).title ?? "";
				s.title = s.control?.title ?? "";
			console.log("pageReady() promise: function ending");
		})/* ?.catch?.(reason => {
			window.reportError(reason);
		}) */;

	//just eye candy
	//if(window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
		//window.setInterval(hueAnimation, 150);
		/*window.setInterval(() => { //spectrum bars (bad performance as of Ffx 114 and Chrome 116 for Windows)
				const bars = "▁▂▃▄▅▆▇█";
				let s = "";
				for(let i = 0; i < 4; i++) {s += bars[Math.floor(Math.random() * bars.length)];}
				document.title = s + " JSON music";
			}, 200);*/
	//}
}
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
//window.addEventListener("load", async event => {pageReady(event);});
//window.addEventListener("load", event => {Promise.resolve().then(value => {pageReady(event);});});
//window.addEventListener("load", event => {Promise.resolve().then(pageReady);});

if(location.pathname.split("/").at(-2) != "json-player") document.title = "JSON music (unstable)";

function overflowToggle(event) {
	const elem = event.target;
	if(!elem || !elem.dataset) {
		console.info("overflowToggle(): parameter event.target(.dataset) is empty. Returning.");
		return false;
	}
	const control = document.getElementById(elem.dataset["target"]);
	if(!control) {
		console.info("overflowToggle(): target box not found. Returning.");
		return false;
	}
	control.classList.toggle("expanded", elem.checked);
	if(elem.dataset["pref"])
		localStorage.setItem(elem.dataset["pref"], JSON.stringify(control.classList.contains("expanded")));
}
function lineWrapToggle(event) {
	const elem = event.target;
	if(!elem) {
		console.info("lineWrapToggle(): parameter event.target is empty. Returning.");
		return false;
	}
	const control = document.getElementById(elem.dataset["target"]);
	if(!control) {
		console.info("lineWrapToggle(): target box not found. Returning.");
		return false;
	}
	control.classList.toggle("line-wrap", elem.checked);
	if(elem.dataset["pref"])
		localStorage.setItem(elem.dataset["pref"], JSON.stringify(control.classList.contains("line-wrap")));
}

//to do: force-allow arbitrary strings for "parseNumber" inputs by using type="text".
function expSpinnerChanged(event) {
	//console.log(event);
	const elem = event.target;
	if(!elem) {
		console.info("expSpinnerChanged(): parameter event.target is empty. Returning.");
		return false;
	}

	//let val = elem.valueAsNumber;
	let val = parseNumber(elem.value);
	const valNaN = isNaN(val);
	elem.classList.toggle("invalid", valNaN);
	if(valNaN) {
		val = 1;
		elem.setCustomValidity("Input not recognized as a real number.");
	} else {
		elem.setCustomValidity("");
	}

	const magnitude = Math.round(Math.log2(Math.abs(val)));
	const stepRatio = NaNToDefault(parseFloat(elem.dataset.stepRatio), 0.25);
	const step = stepRatio * 2 ** magnitude;
	const dynMin = val - 2 * Math.sign(val) * step, min = parseFloat(elem.dataset.min);
	if(min === undefined || isNaN(min)) {
		elem.step = step;
		//if(elem == txtBaseFreq) {elem.min = val - 2 * step;}
		elem.min = dynMin;
	} else {
		elem.step = Math.max(min, step);
		elem.min = Math.max(min, dynMin);
	}
	//console.log(event, elem.checkValidity());
	//elem.checkValidity();
	//elem.reportValidity();
	//elem.setCustomValidity("");
	//if(elem.validity.stepMismatch) {
	//if(!elem.validity.valid) {
	/* if(!elem.checkValidity()) {
		elem.valueAsNumber = 1;
		elem.setCustomValidity("");
		//elem.checkValidity();
		//elem.reportValidity();
	} */
}
/* function expSpinnerInvalid(event) {
	console.log(event);
	event.target.setCustomValidity("");
	event.preventDefault();
	event.stopImmediatePropagation();
	event.stopPropagation();
	//return true;
	return false;
} */
/*function textInvalid(event) { //not working for input type="number"
	event.target.setCustomValidity("");
	event.preventDefault();
	event.stopImmediatePropagation();
	//event.stopPropagation();
	return true;
}*/

function rhythmAccumUpdate() {
	if(!rhythmFactors) rhythmFactors = [];
	const factors = rhythmFactors.slice(); //array clone
	let product = 1;
	rhythmFactorsAccum = [1];
	while(factors.length > 0) {
		product *= factors.pop(); //reverse traversal
		rhythmFactorsAccum.unshift(product); //add as first
	}
	//rhythmFactorsAccum.push(1);
	if(window.outRhythmScales) outRhythmScales.innerText = rhythmFactorsAccum.join("/");
	rhythmFactors.push(1);
	return true;
}

function btnRhythmFactorsGenClick(event) {
	try {
		rhythmFactors = makeRhythmFactors(parseNumber(txtRhythmScale.value), primeCount);
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Rhythm structure generator failed. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	if(window.txtRhythmFactors) {
		txtRhythmFactors.value = rhythmFactors.join("*");
		txtRhythmFactors.dispatchEvent(new Event("input"));
	}
	//rhythmAccumUpdate();
	return true;
}
function btnChordGenClick(event) {
	try {
		freqMin = parseNumber(window.txtFreqRangeMin?.value);
		freqMax = parseNumber(window.txtFreqRangeMax?.value);
		const rootStruct = makeChords(parseInt(txtPatternCount.value), parseInt(txtVoiceCount.value), parseNumber(txtTimeScale.value), primeExpRanges);
		if(rootStruct === false) throw new Error();

		let s = JSON.stringify(rootStruct, null, "\t"); //to do: !function for this repeated code? (also found in following functions and recalcExpRanges)
		//final adjustments on indentation
		let regex = new RegExp(/(?<=\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
		s = s.replace(regex, " ");
		regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
		s = s.replace(regex, "\{$1\}");
		setStructuredText(s);
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in chord generator. " + (error.message ?? error ?? ""), 3);
	}
}
function btnRhythmGenClick(event) {
	try {
		freqMin = parseNumber(window.txtFreqRangeMin?.value);
		freqMax = parseNumber(window.txtFreqRangeMax?.value);
		const rootStruct = makeRhythm(parseInt(txtReptCount.value), chkPercussivePattern.checked, parseNumber(txtTimeScale.value));
		if(rootStruct === false) throw new Error();

		let s = JSON.stringify(rootStruct, null, "\t");
		//final adjustments on indentation
		let regex = new RegExp(/(?<=\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
		s = s.replace(regex, " ");
		regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
		s = s.replace(regex, "\{$1\}");
		setStructuredText(s);
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in rhythm generator. " + (error.message ?? error ?? ""), 3);
	}
}
function btnMelodyGenClick(event) {
	try {
		freqMin = parseNumber(window.txtFreqRangeMin?.value);
		freqMax = parseNumber(window.txtFreqRangeMax?.value);
		const rootStruct = makeMelody(parseInt(txtPatternCount.value), parseNumber(txtReptPeriod.value), parseInt(txtReptCount.value), parseNumber(txtTimeScale.value), chkPercussivePattern.checked, primeExpRanges);
		if(rootStruct === false) throw new Error();

		let s = JSON.stringify(rootStruct, null, "\t");
		//final adjustments on indentation
		let regex = new RegExp(/(?<=\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
		s = s.replace(regex, " ");
		regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
		s = s.replace(regex, "\{$1\}");
		setStructuredText(s);
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in melody generator. " + (error.message ?? error ?? ""), 3);
	}
}
function btnStopClick(event) {
	try {
		if(!playerClip) {
			console.info("btnStopClick(): variable playerClip is empty. Returning.");
			return false;
		}
		playerClip.onClipEnd?.(true);
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Playback stop failed. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}

function deletePrevTab() {
	//outdent line (actually, erase the nearest tab before caret)
	try {
		const rng = window.getSelection?.()?.getRangeAt?.(0); //disregarding multiple selection, which only Firefox supports (to do?)
		if(!rng) {
			console.info("deletePrevTab(): member window.getSelection().getRangeAt(0) is empty. Returning.");
			return false;
		}

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
		if(i < 0) return false;

		//tried to preserve caret position, but the result is buggy
		/*txtBefore = txtBefore.slice(0, i) + txtBefore.slice(i + 1);
		node.textContent = txtBefore + txt.slice(pos);*/
		/*rng.setStart(node, pos - 1);
		rng.setEnd(node, pos - 1);*/

		rng.setStart(node, i);
		rng.setEnd(node, i + 1);
		//rng.deleteContents();
		document.execCommand("delete", false, null); //they say execCommand() is deprecated. currently I haven't found any proper replacement for this command.
		//to do: try a method from Selection instead of from Range, maybe deleteFromDocument()
		rng.setStart(node, pos - 1); //also buggy
		rng.setEnd(node, pos - 1);
	} catch(error) {
		console.warn(error);
		return false;
	}
	return true;
}
function editorKeyDown(event) {
	if(event.key == "Tab") {
		//console.debug(event);
		event.stopPropagation();
		event.preventDefault();

		//tried to dispatch input or beforeinput events. didn't work.
		//event.target.dispatchEvent(new InputEvent("beforeinput", {data: "\t", inputType: "insertText"}));

		event.target.focus(); //necessary?
		//to do: check if selection is wholly contained in code box
		if(event.shiftKey)
			deletePrevTab();
		else
			document.execCommand("insertText", false, "\t"); //to do: !tabify (indent) instead of replacing
	}
	//to do: home key goes past initial indentation?
}
function editorPaste(event) {
	event.preventDefault();

	let paste = (event.clipboardData || window.clipboardData).getData("text");
	const selection = window.getSelection?.();
	if(!selection || !selection.rangeCount) {
		console.info("editorPaste(): member window.getSelection().rangeCount is empty. Returning.");
		return false;
	}
	selection.deleteFromDocument();
	selection.getRangeAt(0).insertNode(document.createTextNode(paste));
	selection.collapseToEnd();
}
function codeEditorResetValidity(event) {
	if(!event || !event.target || !event.target.classList) {
		console.info("codeEditorResetValidity(): parameter event.target.classList is empty. Returning.");
		return false;
	}
	event.target.classList.remove("invalid");
	return true;
}
function editorChanged(event) {
	if(!event || !event.target) {
		console.info("editorChanged(): parameter event.target is empty. Returning.");
		return false;
	}
	event.target.normalize();
	return true;
}
function recalcEditorCursorPos(event) { //not working, at least in Ffx
	const elem = event.target;
	if(!elem) {
		console.info("recalcEditorCursorPos(): parameter event.target is empty. Returning.");
		return false;
	}
	elem.normalize();

	const rng = window.getSelection?.()?.getRangeAt?.(0); //disregarding multiple selection, which only Firefox supports (to do?)
	if(!rng) {
		console.info("recalcEditorCursorPos(): member window.getSelection().getRangeAt(0) is empty. Returning.");
		return false;
	}
	let pos = rng.endOffset;
	let node = rng.endContainer;
	let txt = node.textContent;

	let i, count = 1;
	//const iArr = [];
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
	//document.title = count.toString();
	//document.title = iArr.toString();
}

const focusableElemTypes = ["INPUT", "SELECT", "BUTTON"];
function addToolTipHandler(rootSelector, handler) {
	if(!rootSelector) rootSelector = "body";
	//document.body.addEventListener("touchstart", handler);
	//document.querySelector(rootSelector).addEventListener("touchstart", handler);
	for(const elem of document.querySelectorAll(rootSelector.toString() + " *[title]")) {
		const tagIndex = focusableElemTypes.indexOf(elem.tagName.toUpperCase());
		if(tagIndex >= 0) {
			elem.addEventListener("focus", handler);
			if(tagIndex === 0) elem.addEventListener("input", handler);
		} else
			elem.addEventListener("click", handler);
		//mouse-down and touch detection
		elem.addEventListener("pointerdown", handler);
	}
}
function setToolTip(toolTipCtl, s, warnLevel) {
	if(!toolTipCtl) toolTipCtl = window.outToolTip;
	if(!toolTipCtl) {
		console.info("toolTipCtl(): toolTipCtl parameter and window.outToolTip are both empty. Returning.");
		return false;
	}

	/* if(!s) {
		console.info("toolTipCtl(): parameter s is empty. Returning.");
		return false;
	}
	if(typeof(s) !== "string") s = s.toString(); */
	if(!s) s = "";
	if(typeof(s) !== "string") s = s.toString();
	s = s.trim();

	toolTipCtl.innerText = s;
	//toolTipCtl.innerHTML = s;
	toolTipCtl.classList.toggle("active", s !== "");

	/* if(warnLevel)
		toolTipCtl.dataset.warnLevel = warnLevel.toString();
	else
		delete toolTipCtl.dataset.warnLevel; */
	//accepts a lot, though it might not support it. the value will be dealt by CSS.
	if(warnLevel == undefined || (isNaN(warnLevel) && typeof(warnLevel) === "number"))
		delete toolTipCtl.dataset.warnLevel;
	else
		toolTipCtl.dataset.warnLevel = warnLevel.toString();
	return true;
}
function updateCtlToolTip(event, toolTipCtl) {
	let elem = event.target;
	if(!elem || !elem.title || !elem.title.length)
		elem = event.currentTarget; //for events fired in descendant elements, e.g. td in tr
	if(!elem) {
		console.info("updateCtlToolTip(): parameters event.target or event.currentTarget are either empty or unfit. Returning.");
		return false;
	}
	if(adjustingPreferences) return false;
	//could have focus -> should have focus
	if(focusableElemTypes.includes(elem.tagName.toUpperCase()) && event.type != "pointerdown" && document.activeElement != elem) {
		//console.info(`updateCtlToolTip(): element #${elem.id} (${elem.tagName}) is focusable but not selected. Returning.`);
		return false;
	}

	const sentences = [];
	let description = elem.title;
	if(typeof(description) === "string" && description.length > 0)
		sentences.push(description);

	description = elem.validationMessage;
	if(typeof(description) === "string" && description.length > 0 && (!elem?.validity || !elem?.validity?.stepMismatch))
		sentences.push(description);

	if(sentences.length > 0)
		//setToolTip(toolTipCtl, sentences.join(" "));
		setToolTip(toolTipCtl, sentences.join("\n"));
		//setToolTip(toolTipCtl, sentences.join("<br />"));
}

let lastCodeObjURL = null;
function getDateTimeCode(size) { //hard-coded to Western calendar.
	if(size < 1) return "";
	const now = new Date();
	const dArr = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()];
	if(size < 7) dArr.length = size;
	const dPadding = [4, 2, 2, 2, 2, 2, 3]; //digits per field
	for(const i in dArr)
		dArr[i] = dArr[i].toString().padStart(dPadding[i], "0");
	return dArr.join("-");
}
function structDownload(event) {
	//for the future (as of 2024-08)?: window.showSaveFilePicker()
	try {
		if(!window.ctlStructuredScript) throw new Error("Structured script control not found.");

		//based on code from https://stackoverflow.com/questions/2897619/using-html5-javascript-to-generate-and-save-a-file
		const data = codeEditorContentGet(ctlStructuredScript);
		let file;
		const properties = {type: 'application/json'}; //constructor parameters: file's MIME-type.

		//date for file name
		const fileName = getDateTimeCode(5) + ".mus.json";

		try {
			//specify the filename using the File constructor, but...
			file = new File([data], fileName, properties);
		} catch(error) {
			//...fall back to the Blob constructor if that isn't supported.
			file = new Blob([data], properties);
		}
		if(lastCodeObjURL) URL.revokeObjectURL(lastCodeObjURL);
		lastCodeObjURL = URL.createObjectURL(file);

		if(!window.aStructDownload) throw new Error("Anchor element not found (page may be corrupted).");
		aStructDownload.setAttribute('href', lastCodeObjURL);
		aStructDownload.setAttribute('download', fileName);
		/*const newEvent = new MouseEvent('click');
		aStructDownload.dispatchEvent(newEvent);*/
		aStructDownload.click();
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in file saving. " + (error.message ?? error ?? ""), 3);
		//if(event && event?.target?.title) event.target.title = (error.message ?? error).toString(); //this would overwrite the default title
		return false;
	}
	return true;
}

let animHue = 0;
function hueAnimation() {
	const root = document.documentElement;
	if(!root || !root.style || !root.style.setProperty) return false;
	animHue = (animHue + 360 / 384) % 360;
	//root.style.setProperty("--hue-accent2", animHue);
	root.style.setProperty("--hue-anim", animHue);
}

function addIntervalSamples() {
	console.log("addIntervalSamples(): function starting...");
	//add cells to rows in table body
	const container = document.querySelector("#tblFractionIntervals tbody");
	for(const row of container.children) {
		if(row.tagName.toUpperCase() !== "TR") continue;
		if(row.children.length < 1) continue;
		const firstChild = row.children[0];
		if(firstChild.tagName.toUpperCase() === "TH" || firstChild.classList.contains("tool-tip")) {
			firstChild.colSpan++;
			continue;
		}

		const cell = row.insertCell(4);
		cell.headers = "colSoundSample";
		//cell.classList.add("sample-cell");
		cell.translate = false;
		cell.hidden = true; //for screen reader; later reverted in CSS

		const sampleBtn = document.createElement("button");
		sampleBtn.addEventListener("click", playIntervalHandler);
		sampleBtn.dataset["fraction"] = firstChild.innerText;
		sampleBtn.innerText = "\u{1F442}"; //ear
		//sampleBtn.innerText = "\u{1F50A}"; //speaker
		sampleBtn.classList.add("custom");
		cell.appendChild(sampleBtn);
	}

	{
		//add header cell to row in table header
		const row = document.querySelector("#tblFractionIntervals thead tr");
		const cell = document.createElement("th"); //insertCell would make a td element.
		cell.id = "colSoundSample";
		cell.scope = "col";
		cell.hidden = true;
		//cell.innerHTML = "Sam&shy;ple"; //Sample
		cell.innerHTML = '<span class="lang-static" translate="no">Sam&shy;ple</span><span class="lang-flex" hidden="">Sample</span>';
		row.insertBefore(cell, row.children[4]); //to do: use neighboring header id as reference?
	}
	console.log("addIntervalSamples(): function ending");
}
//to do: !review this code
//to do: separate AudioContext?
function playIntervalHandler(event) {
	if(!event?.target) {
		console.info("playIntervalHandler(): parameter event.target is empty. Returning.");
		return false;
	}
	try {
		let fraction = event.target.dataset["fraction"];
		if(!fraction || fraction == "") throw new Error("Unrecognized interval.");
		fraction = parseNumber(fraction);

		if(rootFreq == 0) throw new Error("Invalid base frequency setting.");
		if(playFreqScale == 0) throw new Error("Invalid playback frequency scale setting.");
		const playTimeScale = NaNToDefault(parseNumber(txtPlayTimeScale.value), defaultBlockNode.timeScale);
		//to do: allow reverse playback? (currently no)
		if(playTimeScale <= 0) throw new Error("Invalid playback time scale setting.");
		//const playTimeDelta = NaNToDefault(parseNumber(txtPlayTimeDelta.value), defaultBlockNode.timeDelta); //question: applicable here?
		const playTimeDelta = 0; //probably not, I think.

		const noteTInterval = 0.25, noteDuration = 3;
		const clip = new SoundClip(null, playTimeScale * (noteDuration + noteTInterval), playTimeScale, playTimeDelta, playVolScale, playFreqScale);
		if(playerClip) clip.audioCtx = playerClip.audioCtx;
		if(!clip.audioCtx || clip.audioCtx.state === 'closed') {
			console.debug("playIntervalHandler(): creating new AudioContext.");
			//clip.audioCtx = new AudioContext({latencyHint: "playback"});
			clip.audioCtx = new AudioContext({latencyHint: "interactive"});
			//clip.audioCtx.addEventListener("statechange", audioCtxDefStateChanged);
		}
		clip.destNode = clip.audioCtx.destination;
		clip.t0 = clip.audioCtx.currentTime - clip.playTimeDelta;

		renderNote(clip, {
				noteStart: 0, noteStop: noteDuration,
				freq: rootFreq, vol: 0.5,
				portamento: 0, vibratoFreq: 0, vibratoDepth: 0, vibratoAttack: 0
			});
		renderNote(clip, {
				noteStart: noteTInterval, noteStop: noteTInterval + noteDuration,
				freq: fraction * rootFreq, vol: 0.5,
				portamento: 0, vibratoFreq: 0, vibratoDepth: 0, vibratoAttack: 0
			});
		if(clip.audioCtx.state === 'suspended')
			clip.audioCtx.resume()?.catch?.(reason => {
					setToolTip(outToolTipIntervals, "Could not resume playback. " + (reason.message ?? reason ?? ""), 3);
					//window.reportError(reason);
					console.error(reason);
				});
		clip.open = true;
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in interval player. " + (error.message ?? error ?? ""), 3);
	}
}

function mainDragOver(event) {
	if(!event) {
		console.info("mainDragOver(): parameter event is empty. Returning.");
		return false;
	}
	event.preventDefault();
	event.dataTransfer.dropEffect = "copy";
	//to do: UI feedback on accepting dragging
}
function mainDrop(event) {
	if(!event || !event.dataTransfer) {
		console.info("mainDrop(): parameter event.dataTransfer is empty. Returning.");
		return false;
	}
	event.preventDefault();
	//const data = event.dataTransfer.getData("application/json");
	if(event.dataTransfer.items) {
		const item = event.dataTransfer.items[0];
		if(!item) {
			setToolTip(outToolTip, "No files were dropped.", 1);
			return false;
		}
		if(item.kind === "string" && item.type.match(/^text\/plain/)) {
			item.getAsString(s => setStructuredText(s));
		} else
			if(item.kind === "file") {
				item.getAsFile().text()?.then?.(value => {
						setStructuredText(value);
					}, reason => {
						setToolTip(outToolTip, "Dropped file could not be read. " + (reason.message ?? reason ?? ""), 3);
						//window.reportError(reason);
						console.error(reason);
					});
			}
	} else {
		if(!event.dataTransfer.files || event.dataTransfer.files.length < 1) {
			setToolTip(outToolTip, "No files were dropped.", 1);
			return false;
		}
		event.dataTransfer.files[0].text()?.then?.(value => {
				setStructuredText(value);
			}, reason => {
				setToolTip(outToolTip, "Dropped file could not be read. " + (reason.message ?? reason ?? ""), 3);
				//window.reportError(reason);
				console.error(reason);
			});
	}
	return true;
}

function btnStructImportClick(event) {
	//for the future (as of 2024-08)?: window.showOpenFilePicker()
	importForm.reset(); //needed to reload when choosing same file on Chrome.
	inFile.showPicker(); //asynchronous
}
function inFileChange(event) {
	const fileList = this.files;
	if(!fileList || fileList.length < 1) {
		setToolTip(outToolTip, "No file was chosen.", 2);
		return false;
	}
	const file = fileList[0];
	file.text()?.then?.(value => {
			setStructuredText(value);
		}, reason => {
			setToolTip(outToolTip, "Chosen file could not be read. " + (reason.message ?? reason ?? ""), 3);
			//window.reportError(reason);
			console.error(reason);
		});
	return true;
}
