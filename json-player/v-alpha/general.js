"use strict";

//to do: put some project-neutral scripts (e.g. parseNumber) in a "shared" file
//to do: return true more often? (in this case, start by finding "return false" occurrences)
//to do: (done?) more console reports and exception handling (success and failure of many operations)
//to do: !consider worker threads or scheduler
//to do: !consider changing flattened format, perhaps radically: events (more like midi), supporting named notes
//to do: multitrack architecture for mixing and effect pipelines, with named tracks
//to do: ...take query parameters (e.g. ?baseFreq=512&makeMelody)
//to do: 	commands to generate, play, reset preferences
//to do: 	take urls to import .mus.json files
//to do: !revise and remove excess dead code
//to do: I think it will be good to put return's even in events
//to do: try more use of promise.then (or async?) for heavy code, hopefully improving UI performance

//to do: !add note release extra time? (so that duration may affect nonspecified next noteStart, but release won't)
const defaultBlockNode = {
	//question: !these names are probably lousy and inconsistent. right now I'm not sure of how to improve.
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
	//note: for non-numbers, isNaN returns whether they can be converted to numbers (e.g. "9" vs. "abc"). undefined returns true.
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
			//question: why not make it almost all left-associative (like JavaScript)?
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
			//"^x" = 2^x (base 2 is a good practical choice)
			if(slices = slicer(n.indexOf("^")))
				return NaNToDefault(slices[0], 2) ** NaNToDefault(slices[1], 1);

			//no operation? try Number() again (may yield NaN).
			return Number(n);
		}
	}

	//a product (object with explicit factors)
	if(t === "object") {
		let r = 1;
		for(const factor of Object.keys(n)) {
			//1 as default base neutralizes unrecognized bases
			//to do: probably there are objects that shouldn't be boiled down straight into numbers. names that can't become numbers may be a sign of that.
			const factorNum = NaNToDefault(parseNumber(factor), 1); //even the factors can actually be complex things
			if(isNaN(factorNum)) continue;
			r *= Math.pow(factorNum, NaNToDefault(parseNumber(n[factor]), 0));
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
function toJSONCodeAdjusted(object) {
	let objCode = JSON.stringify(object, null, "\t");

	//final adjustments on indentation
	let regex = new RegExp(/(?<=\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	objCode = objCode.replace(regex, " ");
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	objCode = objCode.replace(regex, "\{$1\}");

	return objCode;
}

const timeDisplPrecision = 2;

//look-up table to be used in an aspect of the volume envelope
var releaseCurve;
const releaseCurveSize = 8192;

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

function updateRhythmAccum() {
	if(!prefs.rhythmParams.rhythmFactors) prefs.rhythmParams.rhythmFactors = [];
	const factors = prefs.rhythmParams.rhythmFactors.slice(); //array clone
	let product = 1;
	rhythmFactorsAccum = [1];
	while(factors.length > 0) {
		product *= factors.pop(); //reverse traversal
		rhythmFactorsAccum.unshift(product); //add as first
	}
	//rhythmFactorsAccum.push(1);
	if(window.outRhythmScales) outRhythmScales.innerText = rhythmFactorsAccum.join("/");
	prefs.rhythmParams.rhythmFactors.push(1); //? (equalization?)
	return true;
}

function getDateTimeCode(size) { //hard-coded to Western calendar.
	if(size < 1) return "";
	const 
		now = new Date(),
		dArr = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()],
		separators = ["-", "-", "_", "-", "-", "-"]; //something like 1999-12-31_23-59
	if(size < 7) dArr.length = size;
	const dPadding = [4, 2, 2, 2, 2, 2, 3]; //digits per field
	for(const i in dArr)
		dArr[i] = dArr[i].toString().padStart(dPadding[i], "0") + (i < (dArr.length - 1) ? separators[i] : "");
	//return dArr.join("-"); //something like 1999-12-31-23-59
	return dArr.join("");
}
