//to do: check performance difference of strict mode?
"use strict";

//to do: consider worker threads
//to do: ?line numbers in left side in code editors
//to do: ?caret position (row, column, char index) status label
//to do: (structured) music file upload to page
//to do: return true more often? (in this case, start by finding "return false" occurrences)
//to do: consider radically changing flattened format: events (more like midi), supporting named notes
//to do: multitrack architecture for mixing and effect pipelines, with named tracks

//to do: add note release extra time? (so that duration may affect nonspecified next noteStart, but release won't)
const defaultBlockNode = {
	//question: these names are probably lousy and inconsistent. right now I'm not sure of how to improve.
	timeDelta: 0,
	timeScale: 1,

	freqRatio: 1,
	volRatio: 1,

	timbre: "sine",
	q: 1, //for noise resonance; currently undocumented.
	decayFactor: 256, //question: rename this to sustain(Factor)?
	attack: 1 / 64,

	//portamento: 1 / 64,
	portamento: 0,
	vibratoFreq: 2 ** 18 / 86400,
	//vibratoDepth: 1 / 8,
	vibratoDepth: 0,
	vibratoAttack: 3
}, relativeBlockProps = ["timeDelta", "timeScale", "freqRatio", "volRatio"],
 substitutiveProps = ["timbre", "q", "decayFactor", "attack", "portamento", "vibratoFreq", "vibratoDepth", "vibratoAttack"];
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
	vibratoAttack: defaultBlockNode.vibratoAttack //seconds
}, incrementalNoteProps = ["noteStart", "duration", "noteStop", "freq0", "freq", "vol"],
tonalOnlyProps = ["portamento", "vibratoFreq", "vibratoDepth", "vibratoAttack"]; //to do: noise-only properties?

//of course there are infinite primes, but these are more than enough.
var primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47], primeCount = 2, expVariance = 2;

function NaNToDefault(x, def) {
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
		
		try {
			//can be an object
			n = JSON.parse(n);
		} catch(error) {
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

const expSpinners = ["txtBaseFreq", "txtTimeScale", "txtPlayFreqScale", "txtPlayVolScale", "txtPlayTimeScale"];
var autoFlatten = true;
const timeDisplPrecision = 2;

//look-up table to be used in an aspect of the volume envelope
var releaseCurve;
const releaseCurveSize = 8192;

//variability per prime factor (2, 3, 5, 7, ...)
var maxPitches = null;

function docLoaded() {
	//load HTML element references
	for(let s of document.querySelectorAll('[id]'))
		window[s.id] = s;
	if(chkAutoFlatten) chkAutoFlatten.checked = autoFlatten;
	if(outAudioT) outAudioT.innerText = (0).toFixed(timeDisplPrecision);
	if(outAudioDur) outAudioDur.innerText = (0).toFixed(timeDisplPrecision);
	if(txtPrimeCount) txtPrimeCount.max = primes.length.toString();
	//to do: normalize() for ctlStructuredScript and ctlFlatScript?
	
	//build table of exponent variance per prime factor (tonality limitation: high factors are too odd, and should have low exponents)
	//question: too simple? should it depend on primeCount?
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

var adjustingPreferences = false;
function loadPreferences() {
	try {
		adjustingPreferences = true;
		let s;

		//Page appearance
		s = localStorage.getItem("pageAppearance.textSize");
		if(s) {
			textSize = JSON.parse(s);
			document.documentElement.style.fontSize = textSize.toString() + "em";
		}
		s = localStorage.getItem("pageAppearance.theme");
		if(s) {
			cboPageTheme.value = JSON.parse(s);
			cboPageTheme.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("pageAppearance.hue");
		if(s) {
			document.documentElement.style.setProperty("--hue-accent", JSON.parse(s));
		}

		//Generator parameters
		s = localStorage.getItem("genParams.baseFreq");
		if(s) {
			txtBaseFreq.valueAsNumber = JSON.parse(s);
			txtBaseFreq.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.timeScale");
		if(s) {
			txtTimeScale.valueAsNumber = JSON.parse(s);
			txtTimeScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.patternCount");
		if(s) {
			txtPatternCount.valueAsNumber = JSON.parse(s);
			txtPatternCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.primeCount");
		if(s) {
			txtPrimeCount.valueAsNumber = JSON.parse(s);
			txtPrimeCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.expVariance");
		if(s) {
			txtExpVariance.valueAsNumber = JSON.parse(s);
			txtExpVariance.dispatchEvent(new Event("input"));
		}
		
		//Rhythm parameters
		s = localStorage.getItem("rhythmParams.rhythmScale");
		if(s) {
			txtRhythmScale.valueAsNumber = JSON.parse(s);
			txtRhythmScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("rhythmParams.rhythmFactors");
		if(s) {
			txtRhythmFactors.valueAsNumber = JSON.parse(s);
			txtRhythmFactors.dispatchEvent(new Event("input"));
		}

		//Additional generator parameters
		s = localStorage.getItem("addGenParams.voiceCount");
		if(s) {
			txtVoiceCount.valueAsNumber = JSON.parse(s);
			txtVoiceCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("addGenParams.reptCount");
		if(s) {
			txtReptCount.valueAsNumber = JSON.parse(s);
			txtReptCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("addGenParams.reptPeriod");
		if(s) {
			txtReptPeriod.valueAsNumber = JSON.parse(s);
			txtReptPeriod.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("addGenParams.percussivePattern");
		if(s) {
			chkPercussivePattern.valueAsNumber = JSON.parse(s);
			chkPercussivePattern.dispatchEvent(new Event("input"));
		}

		//Structured music editor
		s = localStorage.getItem("structuredMusic.overflow");
		if(s) {
			if(Boolean(JSON.parse(s)))
				ctlStructuredScript.classList.add("expanded");
			else
				ctlStructuredScript.classList.remove("expanded");
		}
		s = localStorage.getItem("structuredMusic.lineWrapping");
		if(s) {
			if(Boolean(JSON.parse(s)))
				ctlStructuredScript.classList.add("lineWrapping");
			else
				ctlStructuredScript.classList.remove("lineWrapping");
		}
		s = localStorage.getItem("structuredMusic.content");
		if(s) {
			ctlStructuredScript.innerText = JSON.parse(s);
			ctlStructuredScript.dispatchEvent(new Event("input"));
		}

		//Flattened note list
		s = localStorage.getItem("flatScript.autoFlatten");
		if(s) {
			chkAutoFlatten.checked = JSON.parse(s);
			chkAutoFlatten.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("flatScript.overflow");
		if(s) {
			if(Boolean(JSON.parse(s)))
				ctlFlatScript.classList.add("expanded");
			else
				ctlFlatScript.classList.remove("expanded");
		}
		s = localStorage.getItem("flatScript.lineWrapping");
		if(s) {
			if(Boolean(JSON.parse(s)))
				ctlFlatScript.classList.add("lineWrapping");
			else
				ctlFlatScript.classList.remove("lineWrapping");
		}
		s = localStorage.getItem("flatScript.content");
		if(s) {
			ctlFlatScript.innerText = JSON.parse(s);
			ctlFlatScript.dispatchEvent(new Event("input"));
		}

		//Overall play controls
		s = localStorage.getItem("clipParams.freqScale");
		if(s) {
			txtPlayFreqScale.valueAsNumber = JSON.parse(s);
			txtPlayFreqScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("clipParams.volScale");
		if(s) {
			txtPlayVolScale.valueAsNumber = JSON.parse(s);
			txtPlayVolScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("clipParams.timeScale");
		if(s) {
			txtPlayTimeScale.valueAsNumber = JSON.parse(s);
			txtPlayTimeScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("clipParams.timeDelta");
		if(s) {
			txtPlayTimeDelta.valueAsNumber = JSON.parse(s);
			txtPlayTimeDelta.dispatchEvent(new Event("input"));
		}

		//Player
		s = localStorage.getItem("player.autoReload");
		if(s) {
			chkAutoReload.checked = JSON.parse(s);
			chkAutoReload.dispatchEvent(new Event("input"));
		}

		//Audio export
		//s = localStorage.getItem("audioExport.");

		//Reset preferences
		s = localStorage.getItem("reset.pageAppearance");
		if(s) {
			chkResetPageAppearance.valueAsNumber = JSON.parse(s);
			chkResetPageAppearance.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.genParams");
		if(s) {
			chkResetGenParams.valueAsNumber = JSON.parse(s);
			chkResetGenParams.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.rhythmParams");
		if(s) {
			chkResetRhythmParams.valueAsNumber = JSON.parse(s);
			chkResetRhythmParams.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.addGenParams");
		if(s) {
			chkResetAddGenParams.valueAsNumber = JSON.parse(s);
			chkResetAddGenParams.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.structuredMusic");
		if(s) {
			chkResetStructuredMusic.valueAsNumber = JSON.parse(s);
			chkResetStructuredMusic.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.flatScript");
		if(s) {
			chkResetFlatScript.valueAsNumber = JSON.parse(s);
			chkResetFlatScript.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.clipParams");
		if(s) {
			chkResetClipParams.valueAsNumber = JSON.parse(s);
			chkResetClipParams.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.player");
		if(s) {
			chkResetPlayer.valueAsNumber = JSON.parse(s);
			chkResetPlayer.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("reset.reset");
		if(s) {
			chkResetReset.valueAsNumber = JSON.parse(s);
			chkResetReset.dispatchEvent(new Event("input"));
		}
	} finally {
		adjustingPreferences = false;
	}
}
function savePreferences() {
	//Page appearance
	localStorage.setItem("pageAppearance.textSize", JSON.stringify(document.children[0].style.fontSize)); //textSize?
	localStorage.setItem("pageAppearance.theme", JSON.stringify(cboPageTheme.value));
	localStorage.setItem("pageAppearance.hue", JSON.stringify(getComputedStyle(document.documentElement).getPropertyValue("--hue-accent")));
	
	//Generator parameters
	localStorage.setItem("genParams.baseFreq", JSON.stringify(txtBaseFreq.valueAsNumber)); //rootFreq?
	localStorage.setItem("genParams.timeScale", JSON.stringify()); //txtTimeScale
	localStorage.setItem("genParams.patternCount", JSON.stringify()); //txtPatternCount
	localStorage.setItem("genParams.primeCount", JSON.stringify(primeCount)); //txtPrimeCount?
	localStorage.setItem("genParams.expVariance", JSON.stringify(expVariance)); //txtExpVariance?
	/*
	//Rhythm parameters
	localStorage.setItem("rhythmParams.rhythmScale", JSON.stringify(txtRhythmScale));
	localStorage.setItem("rhythmParams.rhythmFactors", JSON.stringify(txtRhythmFactors)); //rhythmFactors?
	//Additional generator parameters
	localStorage.setItem("addGenParams.voiceCount", JSON.stringify(txtVoiceCount));
	localStorage.setItem("addGenParams.reptCount", JSON.stringify(txtReptCount));
	localStorage.setItem("addGenParams.reptPeriod", JSON.stringify(txtReptPeriod));
	localStorage.setItem("addGenParams.percussivePattern", JSON.stringify(chkPercussivePattern));
	//Structured music editor
	localStorage.setItem("structuredMusic.overflow", JSON.stringify());
	localStorage.setItem("structuredMusic.lineWrapping", JSON.stringify());
	localStorage.setItem("structuredMusic.content", JSON.stringify(ctlStructuredScript.innerText));
	//Flattened note list
	localStorage.setItem("flatScript.autoFlatten", JSON.stringify(chkAutoFlatten));
	localStorage.setItem("flatScript.overflow", JSON.stringify());
	localStorage.setItem("flatScript.lineWrapping", JSON.stringify());
	localStorage.setItem("flatScript.content", JSON.stringify(ctlFlatScript.innerText));
	//Overall play controls
	localStorage.setItem("clipParams.freqScale", JSON.stringify(playFreqScale)); //txtPlayFreqScale?
	localStorage.setItem("clipParams.volScale", JSON.stringify(playVolScale)); //txtPlayVolScale?
	localStorage.setItem("clipParams.timeScale", JSON.stringify(txtPlayTimeScale));
	localStorage.setItem("clipParams.timeDelta", JSON.stringify(txtPlayTimeDelta));
	//Player
	localStorage.setItem("player.autoReload", JSON.stringify(chkAutoReload));
	//Audio export
	//localStorage.setItem("audioExport.", JSON.stringify());
	//Reset preferences
	localStorage.setItem("reset.pageAppearance", JSON.stringify(chkResetPageAppearance));
	localStorage.setItem("reset.genParams", JSON.stringify(chkResetGenParams));
	localStorage.setItem("reset.rhythmParams", JSON.stringify(chkResetRhythmParams));
	localStorage.setItem("reset.addGenParams", JSON.stringify(chkResetAddGenParams));
	localStorage.setItem("reset.structuredMusic", JSON.stringify(chkResetStructuredMusic));
	localStorage.setItem("reset.flatScript", JSON.stringify(chkResetFlatScript));
	localStorage.setItem("reset.clipParams", JSON.stringify(chkResetClipParams));
	localStorage.setItem("reset.player", JSON.stringify(chkResetPlayer));
	localStorage.setItem("reset.reset", JSON.stringify(chkResetReset));
	*/
}
function resetPreferences() {
	localStorage.clear();
	loadPreferences();
}

let textSize = 1;
function rescaleText(event) {
	if(!document || !document.documentElement || !document.documentElement.style) return false;
	const elem = event.target;
	if(!elem) return false;
	const f = Number(elem.dataset["factor"]);
	textSize *= f;
	document.documentElement.style.fontSize = textSize.toString() + "em"; //html element
}
function themeChanged(event) {
	if(!document) return false;
	const elem = event.target;
	if(!elem) return false;
	const styleTitle = elem.value.toString();
	const sheets = document.querySelectorAll("head link[rel~=stylesheet][title]");
	for(const sheet of sheets) {
		if(!sheet.hasAttribute("title")) continue;
		sheet.disabled = sheet.title !== styleTitle;
		sheet.rel = (sheet.disabled ? "alternate stylesheet" : "stylesheet");
	}
}
function btnHueClick(event) {
	if(!document) return false;
	const elem = event.target;
	if(!elem) return false;
	let delta = Number(elem.dataset["delta"]);

	const root = document.documentElement;
	let hue = getComputedStyle(root).getPropertyValue("--hue-accent");

	//if(hue == undefined) return;
	if(typeof(hue) === "string") hue = parseFloat(hue);
	if(isNaN(hue) || !isFinite(hue)) hue = 120;

	delta *= 30;
	if(event.shiftKey) delta *= 4;
	hue += delta;
	/*hue %= 360; //this wrapping screws filter interpolation. using setTimeout doesn't prevent flashing on hue wrapping.
	if(hue < 0) hue += 360;*/

	root.style.setProperty("--hue-accent", hue);

	/*const metaElems = document.querySelectorAll("head meta[name=theme-color]");
	for(const elem2 of metaElems) {
		if(elem2.hasAttribute("media")) { //test (to do?)
			if(elem2.getAttribute("media").toLowerCase() == "(prefers-color-scheme: dark)")
				elem2.setAttribute("content", "darkred");
			else
				elem2.setAttribute("content", "chartreuse");
		} else
			elem2.setAttribute("content", "red");
	}*/
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
	if(!txtPrimeCount) return false;
	primeCount = NaNToDefault(parseNumber(txtPrimeCount.value), 2);
	if(primeCount < 2) primeCount = 2;
	if(outPrimeList) outPrimeList.innerText = "(" + primes.slice(0, primeCount).join(",") + ")";
}

//to do: force-allow arbitrary strings for "parseNumber" inputs by using type="text".
function expSpinnerChanged(event) {
	//console.log(event);
	const elem = event.target;
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
	const magnitude = Math.round(Math.log2(Math.abs(val))), step = 0.25 * 2 ** magnitude;
	elem.step = step;
	//if(elem == txtBaseFreq) {elem.min = val - 2 * step;}
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
	if(!txtBaseFreq) return false;
	rootFreq = parseNumber(txtBaseFreq.value);
	if(!rootFreq) {
		txtBaseFreq.classList.add("invalid");
		txtBaseFreq.setCustomValidity("Base frequency shouldn't be 0.");
		rootFreq = defaultRootFreq;
	} else {
		txtBaseFreq.classList.remove("invalid");
		txtBaseFreq.setCustomValidity("");
	}
}
function playFreqScaleChanged() {
	if(!txtPlayFreqScale) return false;
	//if(txtPlayFreqScale.valueAsNumber <= 0) txtPlayFreqScale.stepUp();
	playFreqScale = NaNToDefault(parseNumber(txtPlayFreqScale.value), defaultBlockNode.freqRatio);
	if(playerClip) playerClip.playFreqScale = playFreqScale;
}
function playVolScaleChanged() {
	if(!txtPlayVolScale) return false;
	//if(txtPlayVolScale.valueAsNumber < 0) txtPlayVolScale.stepUp();
	playVolScale = NaNToDefault(parseNumber(txtPlayVolScale.value), defaultBlockNode.volRatio);
	if(playerClip) playerClip.playVolScale = playVolScale;
}

//rhythm structure data (hierarchy of factors)
var rhythmFactors = [], rhythmFactorsAccum = []; //to do: rename rhythmFactorsAccum -> rhythmScales?
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
	if(outRhythmScales) outRhythmScales.innerText = rhythmFactorsAccum.join("/");
	rhythmFactors.push(1);
}
function rhythmFactorsChanged() {
	//to do: support additive time signatures (e.g. 3 beats + 4 beats -> 1001000)? (would probably turn rhythmFactors into a tree)
	//  to do: how should we interpret a heterogeneous number of factors, e.g. 3 + 2*2 (top-down vs. bottom-up)? like (2 + 2 + 2) + ((1 + 1) + (1 + 1)) or (1 + 1 + 1) + ((1 + 1) + (1 + 1))?
	//to do: support rational numbers (e.g. 4/3 beats) without reducing to floats?
	if(!txtRhythmFactors) return false;
	let s = txtRhythmFactors.value.toString(); //text
	rhythmFactors = []; //will become an array of numbers
	if(s.length >= 1) {
		s = exprEliminateParens(s).split("*"); //multiplications inside parens won't be parsed as rhythmic levels
		for(const n of s) {
			//expand powers (e.g. 2^3 -> 2*2*2 -> [2, 2, 2], not [8])
			const pos = n.indexOf("^");
			if(pos >= 0) {
				const base = NaNToDefault(parseNumber(n.slice(0, pos)), 2);
				for(let exp = NaNToDefault(parseNumber(n.slice(pos + 1)), 1); exp >= 1; exp--)
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

		txtRhythmFactors.classList.remove("invalid");
		txtRhythmFactors.setCustomValidity("");
	} catch(error) {
		//default/fallback
		rhythmFactors = [2, 2, 2]; //question: choose a different default? (perhaps based on primeCount)
		txtRhythmFactors.classList.add("invalid");
		txtRhythmFactors.setCustomValidity(error.toString());
	}
	rhythmAccumUpdate();
}

function btnStopClick(event) {
	if(!playerClip) return;
	if(playerClip.onClipEnd) playerClip.onClipEnd(); else emptyClip(playerClip);
	playerClip.audioCtx?.suspend?.();
}

function deletePrevTab() {
	//outdent line (actually, erase the nearest tab before caret)
	const rng = getSelection().getRangeAt(0); //disregarding multiple selection, which only Firefox supports
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
	document.execCommand("delete", false, null); //they say execCommand() is deprecated. currently I haven't found any proper replacement for this command.
	rng.setStart(node, pos - 1); //also buggy
	rng.setEnd(node, pos - 1);
}
function editorKeyDown(event) {
	if(event.key == "Tab") {
		//console.debug(event);
		event.stopPropagation();
		event.preventDefault();

		//tried to dispatch input or beforeinput events. didn't work.
		//event.target.dispatchEvent(new InputEvent("beforeinput", {data: "\t", inputType: "insertText"}));

		event.target.focus(); //unnecessary?
		if(event.shiftKey)
			deletePrevTab();
		else
			document.execCommand("insertText", false, "\t");
	}
	//to do: home key goes past initial indentation?
}
function editorInput(event) {
	if(!event || !event.target || !event.target.classList) return false;
	event.target.classList.remove("invalid");
}
function recalcEditorCursorPos(event) { //not working, at least in Ffx
	const elem = event.target;
	if(!elem) return false;
	elem.normalize();
	
	const rng = getSelection().getRangeAt(0); //disregarding multiple selection, which only Firefox supports
	if(!rng) return false;
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

const focusableElemTypes = ["INPUT", "BUTTON"];
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
		//elem.addEventListener("mouseenter", handler);
		//elem.addEventListener("mouseover", handler);
		//elem.addEventListener("pointerenter", handler);
		//elem.addEventListener("pointerover", handler);
	}

}
function setToolTip(event, outToolTip) {
	if(!outToolTip) outToolTip = window.outToolTip;
	if(!outToolTip) return false;
	let elem = event.target;
	if(!elem || !elem.title || !elem.title.length)
		elem = event.currentTarget; //for events fired in descendant elements, e.g. td in tr
	if(!elem) return false;
	if(focusableElemTypes.includes(elem.tagName.toUpperCase()) && event.type != "pointerdown" && document.activeElement != elem)
		return false; //could have focus -> should have focus

	const sentences = [];
	let description = elem.title;
	if(typeof(description) === "string" && description.length > 0)
		sentences.push(description);

	description = elem.validationMessage;
	if(typeof(description) === "string" && description.length > 0)
		sentences.push(description);

	if(sentences.length > 0) {
		//outToolTip.innerText = sentences.join(" ");
		outToolTip.innerText = sentences.join("\n");
		//outToolTip.innerHTML = sentences.join("<br />");
		outToolTip.style.position = "sticky";
	}
}

let lastCodeObjURL = null;
function getDateTimeCode(size) {
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
	if(!ctlStructuredScript) return false;
	//based on code from https://stackoverflow.com/questions/2897619/using-html5-javascript-to-generate-and-save-a-file
	const data = [ctlStructuredScript.innerText];
	//const data = [ctlStructuredScript.value];
	let file;
	const properties = {type: 'application/json'}; //constructor parameters: file's MIME-type.
	
	//date for file name
	const fileName = getDateTimeCode(5) + ".mus.json";
	
	try {
		//specify the filename using the File constructor, but...
		file = new File(data, fileName, properties);
	} catch(error) {
		//...fall back to the Blob constructor if that isn't supported.
		file = new Blob(data, properties);
	}
	if(lastCodeObjURL) URL.revokeObjectURL(lastCodeObjURL);
	lastCodeObjURL = URL.createObjectURL(file);
	
	if(!aStructDownload) return false;
	aStructDownload.setAttribute('href', lastCodeObjURL);
	aStructDownload.setAttribute('download', fileName);
	
	/*const newEvent = new MouseEvent('click');
	aStructDownload.dispatchEvent(newEvent);*/
	aStructDownload.click();
	return true;
}

function scrollUpdate(event) {
	//console.log(event);
	//let elem = document.scrollingElement;
	let elem = event.target ?? event.currentTarget;
	if(elem.documentElement) elem = elem.documentElement;
	//console.log(elem);
	if(!elem || !elem.style) return;
	//const root = document.documentElement;
	//root.style.setProperty("--hue-accent", (360 * elem.scrollTop / elem.scrollTopMax)); //cool
	//root.style.setProperty("--hue-scroll", (360 * elem.scrollTop / elem.scrollTopMax));
	elem.style.setProperty("--hue-scroll", (360 * elem.scrollTop / elem.scrollTopMax));

	/*const scrollYPages = elem.scrollTop / elem.clientHeight;
	const setTranslate = (id, dy) => {document.getElementById(id).style.translate = "0% " + (- 100 * dy).toString() + "%";};
	for(let i = 1; i <= 2; i++) {
		//const y = scrollYPages / i;
		//const y = scrollYPages / (5 - i);
		//const y = 4 * scrollYPages / i;
		const y = scrollYPages * 0.5 ** i;
		//const y = scrollYPages * 0.5 ** (5 - i);
		setTranslate(`noise${i}rect1`, (y + 1) % 2 - 1);
		setTranslate(`noise${i}rect2`, (y + 0) % 2 - 0);
	}*/
}
function resizeUpdate(event) {
	//document.getElementById("imgBgLayer1").style.height = document.body.children[0].scrollHeight;
	document.documentElement.style.setProperty("--scroll-height", document.getElementById("wrapper2").scrollHeight);
	//for(let i = 1; i <= 3; i++)
	//	document.getElementById(`imgBgLayer${i}`).style.height = document.getElementById("wrapper2").scrollHeight.toString() + "px";
}

let animHue = 0;
function hueAnimation() {
	const root = document.documentElement;
	if(!root || !root.style || !root.style.setProperty) return;
	animHue = (animHue + 360 / 384) % 360;
	//root.style.setProperty("--hue-accent2", animHue);
	root.style.setProperty("--hue-anim", animHue);
}

function addIntervalSamples() {
	{
		//add cell to row in table header
		const row = document.querySelector("#tblFractionIntervals thead tr");
		const cell = document.createElement("th"); //insertCell would make a td element.
		cell.scope = "col";
		cell.innerHTML = "Sam&shy;ple";
		row.insertBefore(cell, row.children[4]);
	}

	//add cells to rows in table body
	const container = document.querySelector("#tblFractionIntervals tbody");
	for (const row of container.children) {
		if(row.tagName.toUpperCase() !== "TR") continue;
		if(row.children.length < 1) continue;
		if(row.children[0].tagName.toUpperCase() === "TH" || row.children[0].classList.contains("tool-tip")) {
			row.children[0].colSpan++;
			continue;
		}

		const cell = row.insertCell(4);
		cell.classList.add("sample-cell");
		cell.addEventListener("click", playIntervalHandler);
		cell.dataset["fraction"] = row.children[0].innerText;
		cell.innerText="\u{1F442}"; //ear
		//cell.innerText="\u{1F50A}"; //speaker
	}
}
//to do: review this code
//to do: separate AudioContext?
function playIntervalHandler(event) {
	//event.preventDefault();
	if(!event?.target) return;
	let fraction = event.target.dataset["fraction"];
	if(!fraction || fraction == "") return;
	fraction = parseNumber(fraction);

	if(rootFreq == 0) return false;
	if(playFreqScale == 0) return false;
	const playTimeScale = NaNToDefault(parseNumber(txtPlayTimeScale.value), defaultBlockNode.timeScale);
	//to do: allow reverse playback?
	if(playTimeScale <= 0) return false;
	//const playTimeDelta = NaNToDefault(parseNumber(txtPlayTimeDelta.value), defaultBlockNode.timeDelta); //question: applicable here?
	const playTimeDelta = 0; //probably not, I think.

	const noteInterval = 0.25, noteDuration = 3;
	const clip = new SoundClip(null, playTimeScale * (noteDuration + noteInterval), playTimeScale, playTimeDelta, playVolScale, playFreqScale);
	if(playerClip) clip.audioCtx = playerClip.audioCtx;
	if(!clip.audioCtx || clip.audioCtx.state === 'closed') {
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
		noteStart: noteInterval, noteStop: noteInterval + noteDuration,
		freq: fraction * rootFreq, vol: 0.5,
		portamento: 0, vibratoFreq: 0, vibratoDepth: 0, vibratoAttack: 0
	});
	if(clip.audioCtx.state === 'suspended') clip.audioCtx.resume();
	clip.open = true;
}
