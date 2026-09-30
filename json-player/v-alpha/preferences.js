"use strict";

var primeCount = 2, expVariance = 2;
var autoFlatten = true;

//persistence feature under construction
var adjustingPreferences = false;
function loadPreferences() {
	try {
		adjustingPreferences = true;
		let s;

		//Reset preferences (influences later conditionals)
		if(!chkResetReset.checked) {
			if(s = localStorage.getItem("reset.pageAppearance")) {
				chkResetPageAppearance.checked = JSON.parse(s);
				//chkResetPageAppearance.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.genParams")) {
				chkResetGenParams.checked = JSON.parse(s);
				//chkResetGenParams.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.rhythmParams")) {
				chkResetRhythmParams.checked = JSON.parse(s);
				//chkResetRhythmParams.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.addGenParams")) {
				chkResetAddGenParams.checked = JSON.parse(s);
				//chkResetAddGenParams.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.structuredMusic")) {
				chkResetStructuredMusic.checked = JSON.parse(s);
				//chkResetStructuredMusic.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.flatScript")) {
				chkResetFlatScript.checked = JSON.parse(s);
				//chkResetFlatScript.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.clipParams")) {
				chkResetClipParams.checked = JSON.parse(s);
				//chkResetClipParams.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.player")) {
				chkResetPlayer.checked = JSON.parse(s);
				//chkResetPlayer.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("reset.reset")) {
				chkResetReset.checked = JSON.parse(s);
				//chkResetReset.dispatchEvent(new Event("input"));
			}
		}

		//Page appearance
		if(!chkResetPageAppearance.checked) {
			if(s = localStorage.getItem("pageAppearance.textSize")) {
				textSize = JSON.parse(s);
				//document.documentElement.style.fontSize = textSize.toString() + "em";
				document.documentElement.style.setProperty("--page-scale", textSize);
			}
			if(s = localStorage.getItem("pageAppearance.theme")) {
				cboPageTheme.value = s;
				cboPageTheme.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("pageAppearance.hue")) {
				const hue = parseNumber(JSON.parse(s)), hueMod = ((hue % 360) + 360.0) % 360.0;
				document.documentElement.style.setProperty("--hue-accent0", hueMod);
				//document.documentElement.style.setProperty("--hue-accent-init", hueMod);
				updateThemeColor(hueMod);
			}
		}

		//Generator parameters
		if(!chkResetGenParams.checked) {
			if(s = localStorage.getItem("genParams.baseFreq")) {
				txtBaseFreq.value = s;
				txtBaseFreq.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("genParams.freqRangeMin")) {
				txtFreqRangeMin.value = s;
				txtFreqRangeMin.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("genParams.freqRangeMax")) {
				txtFreqRangeMax.value = s;
				txtFreqRangeMax.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("genParams.timeScale")) {
				txtTimeScale.value = s;
				txtTimeScale.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("genParams.patternCount")) {
				txtPatternCount.value = s;
				txtPatternCount.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("genParams.primeCount")) {
				txtPrimeCount.value = s;
				txtPrimeCount.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("genParams.expVariance")) {
				txtExpVariance.value = s;
				txtExpVariance.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("genParams.primeExpRanges")) {
				codeEditorContentSet(ctlPrimeExpRanges, s);
				ctlPrimeExpRanges.dispatchEvent(new Event("input"));
			} else
				recalcExpRanges(true);
		}

		//Rhythm parameters
		if(!chkResetRhythmParams.checked) {
			if(s = localStorage.getItem("rhythmParams.rhythmScale")) {
				txtRhythmScale.value = s;
				txtRhythmScale.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("rhythmParams.rhythmFactors")) {
				txtRhythmFactors.value = s;
				txtRhythmFactors.dispatchEvent(new Event("input"));
			}
		}

		//Additional generator parameters
		if(!chkResetAddGenParams.checked) {
			if(s = localStorage.getItem("addGenParams.voiceCount")) {
				txtVoiceCount.value = s;
				txtVoiceCount.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("addGenParams.reptCount")) {
				txtReptCount.value = s;
				txtReptCount.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("addGenParams.reptPeriod")) {
				txtReptPeriod.value = s;
				txtReptPeriod.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("addGenParams.percussivePattern")) {
				chkPercussivePattern.checked = JSON.parse(s);
				chkPercussivePattern.dispatchEvent(new Event("click")); //question: input or click event for check boxes?
			}
		}

		//Structured music editor
		if(!chkResetStructuredMusic.checked) {
			if(s = localStorage.getItem("structuredMusic.overflow")) {
				const parsed = JSON.parse(s);
				chkOverflow1.checked = parsed;
				//chkOverflow1.dispatchEvent(new Event("input"));
				ctlStructuredScript.classList.toggle("expanded", parsed);
			}
			if(s = localStorage.getItem("structuredMusic.lineWrapping")) {
				const parsed = JSON.parse(s);
				chkLineWrap1.checked = parsed;
				//chkLineWrap1.dispatchEvent(new Event("input"));
				ctlStructuredScript.classList.toggle("line-wrap", parsed);
			}
			if(s = localStorage.getItem("structuredMusic.content")) {
				codeEditorContentSet(ctlStructuredScript, s);
				ctlStructuredScript.dispatchEvent(new Event("input"));
			}
		}

		//Flattened note list
		if(!chkResetFlatScript.checked) {
			if(s = localStorage.getItem("flatScript.autoFlatten")) {
				chkAutoFlatten.checked = JSON.parse(s);
				chkAutoFlatten.dispatchEvent(new Event("click"));
			}
			if(s = localStorage.getItem("flatScript.overflow")) {
				const parsed = JSON.parse(s);
				chkOverflow2.checked = parsed;
				//chkOverflow2.dispatchEvent(new Event("input"));
				ctlFlatScript.classList.toggle("expanded", parsed);
			}
			if(s = localStorage.getItem("flatScript.lineWrapping")) {
				const parsed = JSON.parse(s);
				chkLineWrap2.checked = parsed;
				//chkLineWrap2.dispatchEvent(new Event("input"));
				ctlFlatScript.classList.toggle("line-wrap", parsed);
			}
			if(s = localStorage.getItem("flatScript.content")) {
				codeEditorContentSet(ctlFlatScript, s);
				ctlFlatScript.dispatchEvent(new Event("input"));
			}
		}

		//Overall play controls
		if(!chkResetClipParams.checked) {
			if(s = localStorage.getItem("clipParams.freqScale")) {
				txtPlayFreqScale.value = s;
				txtPlayFreqScale.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("clipParams.volScale")) {
				txtPlayVolScale.value = s;
				txtPlayVolScale.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("clipParams.timeScale")) {
				txtPlayTimeScale.value = s;
				txtPlayTimeScale.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("clipParams.timeDelta")) {
				txtPlayTimeDelta.value = s;
				txtPlayTimeDelta.dispatchEvent(new Event("input"));
			}
		}

		//Player
		if(!chkResetPlayer.checked) {
			if(s = localStorage.getItem("player.autoReload")) {
				chkAutoReload.checked = JSON.parse(s);
				chkAutoReload.dispatchEvent(new Event("click"));
			}
		}

		//Audio export
		/* if(!chkResetAudioExport.checked) {
			s = localStorage.getItem("audioExport.");
		} */
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to load preferences. " + (error.message ?? error ?? ""), 3);
		return false;
	} finally {
		adjustingPreferences = false;
	}
	return true;
}
function savePreferences() {
	try {
		//Page appearance
		localStorage.setItem("pageAppearance.textSize", JSON.stringify(textSize)); //getComputedStyle(document.documentElement).getPropertyValue("--page-scale")?
		localStorage.setItem("pageAppearance.theme", cboPageTheme.value);
		localStorage.setItem("pageAppearance.hue", getComputedStyle(document.documentElement).getPropertyValue("--hue-accent0").toString());
		//Generator parameters
		localStorage.setItem("genParams.baseFreq", txtBaseFreq.value); //JSON.stringify(rootFreq)?
		localStorage.setItem("genParams.freqRangeMin", txtFreqRangeMin.value); //JSON.stringify(freqMin)?
		localStorage.setItem("genParams.freqRangeMax", txtFreqRangeMax.value); //JSON.stringify(freqMax)?
		localStorage.setItem("genParams.timeScale", txtTimeScale.value);
		localStorage.setItem("genParams.patternCount", txtPatternCount.value);
		localStorage.setItem("genParams.primeCount", txtPrimeCount.value); //JSON.stringify(primeCount)?
		localStorage.setItem("genParams.expVariance", txtExpVariance.value); //JSON.stringify(expVariance)?
		localStorage.setItem("genParams.primeExpRanges", codeEditorContentGet(ctlPrimeExpRanges));
		//Rhythm parameters
		localStorage.setItem("rhythmParams.rhythmScale", txtRhythmScale.value);
		localStorage.setItem("rhythmParams.rhythmFactors", txtRhythmFactors.value); //JSON.stringify(rhythmFactors)?
		//Additional generator parameters
		localStorage.setItem("addGenParams.voiceCount", txtVoiceCount.value);
		localStorage.setItem("addGenParams.reptCount", txtReptCount.value);
		localStorage.setItem("addGenParams.reptPeriod", txtReptPeriod.value);
		localStorage.setItem("addGenParams.percussivePattern", JSON.stringify(chkPercussivePattern.checked));
		//Structured music editor
		localStorage.setItem("structuredMusic.overflow", JSON.stringify(ctlStructuredScript.classList.contains("expanded")));
		localStorage.setItem("structuredMusic.lineWrapping", JSON.stringify(ctlStructuredScript.classList.contains("line-wrap")));
		localStorage.setItem("structuredMusic.content", codeEditorContentGet(ctlStructuredScript));
		//Flattened note list
		localStorage.setItem("flatScript.autoFlatten", JSON.stringify(chkAutoFlatten.checked));
		localStorage.setItem("flatScript.overflow", JSON.stringify(ctlFlatScript.classList.contains("expanded")));
		localStorage.setItem("flatScript.lineWrapping", JSON.stringify(ctlFlatScript.classList.contains("line-wrap")));
		localStorage.setItem("flatScript.content", codeEditorContentGet(ctlFlatScript));
		//Overall play controls
		localStorage.setItem("clipParams.freqScale", txtPlayFreqScale.value); //JSON.stringify(playFreqScale)?
		localStorage.setItem("clipParams.volScale", txtPlayVolScale.value); //JSON.stringify(playVolScale)?
		localStorage.setItem("clipParams.timeScale", txtPlayTimeScale.value);
		localStorage.setItem("clipParams.timeDelta", txtPlayTimeDelta.value);
		//Player
		localStorage.setItem("player.autoReload", JSON.stringify(chkAutoReload.checked));
		//Audio export
		//localStorage.setItem("audioExport.", JSON.stringify());
		//Reset preferences
		localStorage.setItem("reset.pageAppearance", JSON.stringify(chkResetPageAppearance.checked));
		localStorage.setItem("reset.genParams", JSON.stringify(chkResetGenParams.checked));
		localStorage.setItem("reset.rhythmParams", JSON.stringify(chkResetRhythmParams.checked));
		localStorage.setItem("reset.addGenParams", JSON.stringify(chkResetAddGenParams.checked));
		localStorage.setItem("reset.structuredMusic", JSON.stringify(chkResetStructuredMusic.checked));
		localStorage.setItem("reset.flatScript", JSON.stringify(chkResetFlatScript.checked));
		localStorage.setItem("reset.clipParams", JSON.stringify(chkResetClipParams.checked));
		localStorage.setItem("reset.player", JSON.stringify(chkResetPlayer.checked));
		localStorage.setItem("reset.reset", JSON.stringify(chkResetReset.checked));
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to bulk-save preferences. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}
function resetAllPreferences() {
	localStorage.clear();
	loadPreferences(); //?
}

let textSize = 1;
function rescaleText(event) {
	if(!document || !document.documentElement || !document.documentElement.style) return false;
	const elem = event.target;
	if(!elem) {
		console.info("rescaleText(): parameter event.target is empty. Returning.");
		return false;
	}
	const f = Number(elem.dataset["factor"]);
	textSize *= f;
	const strTextSize = textSize.toPrecision(5);
	textSize = Number(strTextSize);
	//document.documentElement.style.fontSize = textSize.toString() + "em"; //html element
	document.documentElement.style.setProperty("--page-scale", textSize);

	localStorage.setItem("pageAppearance.textSize", strTextSize);
	return true;
}
function themeChanged(event) {
	if(!document) return false;
	const elem = event.target;
	if(!elem) {
		console.info("themeChanged(): parameter event.target is empty. Returning.");
		return false;
	}
	const styleTitle = elem.value.toString();
	const sheets = document.querySelectorAll("head link[rel~=stylesheet][title]");
	for(const sheet of sheets) {
		if(!sheet.hasAttribute("title")) continue;
		sheet.disabled = sheet.title !== styleTitle;
		sheet.rel = (sheet.disabled ? "alternate stylesheet" : "stylesheet");
	}
	updateThemeColor(getComputedStyle(document.documentElement).getPropertyValue("--hue-accent0"));
	return true;
}
function updateThemeColor(hue) {
	const hueStr = hue.toString();
	[ //to do: reconsider this (probably should just follow current theme)
		["(prefers-color-scheme: light)", `hsl(${hueStr}, 37.5%, 75%)`],
		["(prefers-color-scheme: dark)", `hsl(${hueStr}, 37.5%, 25%)`],
		["(prefers-color-scheme: light) and (prefers-contrast: more)", `hsl(${hueStr}, 50%, 12.5%)`],
		["(prefers-contrast: more)", `hsl(${hueStr}, 50%, 87.5%)`],
		["all", `hsl(${hueStr}, 25%, 50%)`]
	].forEach(medium => {
			const metaElem = document.querySelector(`meta[name="theme-color"][media="${medium[0]}"]`);
			if(metaElem) metaElem.content = medium[1];
		});
	//cboPageTheme.value
}
function btnHueClick(event) {
	if(!document) return false;
	const elem = event.target;
	if(!elem) {
		console.info("btnHueClick(): parameter event.target is empty. Returning.");
		return false;
	}
	let delta = Number(elem.dataset["delta"]);

	const root = document.documentElement;
	let hue = getComputedStyle(root).getPropertyValue("--hue-accent0");

	//if(hue == undefined) return false;
	if(typeof(hue) === "string") hue = parseFloat(hue);
	if(isNaN(hue) || !isFinite(hue)) hue = 120;

	delta *= 30; //to do: hue would be better measured in 120-degree steps, instead of 30
	if(event.shiftKey) delta *= 4;
	hue += delta;
	/*hue %= 360; //this wrapping screws filter interpolation. using setTimeout doesn't prevent flashing on hue wrapping.
	if(hue < 0) hue += 360;*/

	root.style.setProperty("--hue-accent0", hue);
	updateThemeColor(hue);

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

	localStorage.setItem("pageAppearance.hue", JSON.stringify(hue));
}

function primeCountChanged(event) {
	if(!window.txtPrimeCount) return false;
	primeCount = NaNToDefault(parseNumber(txtPrimeCount.value), 2);
	if(primeCount < 1.25) primeCount = 1.25;
	if(primeCount > primes.length) primeCount = primes.length;

	const lastPrime = Math.ceil(primeCount), primesList = primes.slice(0, lastPrime);
	//for fractional sizes, represent the last prime in a different way
	if(primeCount % 1 > 0) primesList[lastPrime - 1] = `<span class="partial">${primesList[lastPrime - 1]}</span>`;
	//if(window.outPrimeList) outPrimeList.innerText = "[" + primesList.join(", ") + "]";
	if(window.outPrimeList) outPrimeList.innerHTML = "[" + primesList.join(", ") + "]";
	recalcExpRanges();
	return true;
}
function expVarianceChanged(event) {
	if(!window.txtExpVariance) return false;
	expVariance = NaNToDefault(parseNumber(txtExpVariance.value), 2);
	if(expVariance < 0.5) expVariance = 0.5;
	if(expVariance > 8) expVariance = 8;
	recalcExpRanges();
}
function recalcExpRanges(force) {
	if(adjustingPreferences && !force) return false; //fails silently
	//primeCount = NaNToDefault(parseNumber(txtPrimeCount.value), 2);
	//expVariance = NaNToDefault(parseNumber(txtExpVariance.value), 2);

	try {
		const primeCountCeil = Math.ceil(primeCount);
		//const newExpRanges = new Array(primeCountCeil);
		const newExpRanges = {};
		//build table of exponent variance per prime factor (tonality limitation: high factors are too odd, and should have low exponents)
		for(let i = 0; i < primeCountCeil; i++) {
			const 
				varFraction = (i <= primeCount - 1 ? 1 : (primeCount % 1)), 
				range = varFraction * expVariance / Math.log2(primes[i]);

			//newExpRanges[i] = range;
			//question: what will be the proper default range? can the factors only go upwards? is signed (bipolar) random better?
			newExpRanges[primes[i]] = [0, range];
			//newExpRanges[primes[i]] = [-0.5 * range, range];
			//newExpRanges[primes[i]] = [-range, range];
		}
		primeExpRanges = newExpRanges;

		const objText = toJSONCodeAdjusted(newExpRanges);
		if(window.ctlPrimeExpRanges) {
			codeEditorContentSet(ctlPrimeExpRanges, objText);
			saveControlPreference(ctlPrimeExpRanges);
		} else
			throw(new Error("Control ctlPrimeExpRanges not found."));
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to refresh exponent variance ranges. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}

//I know the human ear is supposed to hear more than this, but it's already outside the ordinary. I can barely hear these extremes.
const defaultRootFreq = 440, defaultFreqMin = 30, defaultFreqMax = 13000;
var rootFreq = defaultRootFreq, freqMin = defaultFreqMin, freqMax = defaultFreqMax;
function baseFreqChanged(event) {
	if(!window.txtBaseFreq) return false;
	rootFreq = parseNumber(txtBaseFreq.value);
	txtBaseFreq.classList.toggle("invalid", !rootFreq);
	if(!rootFreq) {
		txtBaseFreq.setCustomValidity("Base frequency shouldn't be 0.");
		rootFreq = defaultRootFreq;
	} else {
		txtBaseFreq.setCustomValidity("");
	}
	return true;
}
//to do: handler for frequency extremes, calling updateVisAreaTransform()? (currently, changing the thresholds during play requires pause-toggling for visualizer updating)

//rhythm structure data (hierarchy of factors)
const defaultRhythmFactors = [2, 2, 2]; //question: choose a different default? (perhaps based on primeCount)
var rhythmFactors = [], rhythmFactorsAccum = []; //to do: rename rhythmFactorsAccum -> rhythmScales?
function rhythmFactorsChanged(event) {
	//to do: !support additive time signatures (e.g. 3 beats + 4 beats -> 1001000)? (would probably turn rhythmFactors into a tree)
	//	to do: !how should we interpret a heterogeneous number of factors, e.g. 3 + 2*2 (top-down vs. bottom-up)? like (2 + 2 + 2) + ((1 + 1) + (1 + 1)) or (1 + 1 + 1) + ((1 + 1) + (1 + 1))?
	//		maybe bottom-up: 3 + 2*2 would be like 3*1 + 2*2. seems conceptually simpler.
	//to do: support rational numbers (e.g. 4/3 beats) without reducing to floats?
	//to do: !maybe interpret the rightmost factor (deepest into the small scale) as a duration in pulses, not a multiple of pulses, which would change the number of levels (2 * 2 would have 4/2 as levels, instead of 4/2/1)
	if(!window.txtRhythmFactors) return false;
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
			throw(new Error("Rhythm factors can't include zero."));

		if(rhythmFactors.some(x => isNaN(x))) //unparsed expressions?
			throw(new Error("Unrecognized numerical expression in rhythm formula."));

		txtRhythmFactors.classList.remove("invalid");
		txtRhythmFactors.setCustomValidity("");
	} catch(error) {
		console.error(error);
		//default/fallback
		rhythmFactors = defaultRhythmFactors;
		txtRhythmFactors?.classList?.add?.("invalid");
		txtRhythmFactors?.setCustomValidity?.(error.toString());
		return false;
	}
	rhythmAccumUpdate();
	return true;
}

var playFreqScale = 1, playVolScale = 1;
function playFreqScaleChanged(event) {
	if(!window.txtPlayFreqScale) return false;
	//if(txtPlayFreqScale.valueAsNumber <= 0) txtPlayFreqScale.stepUp();
	playFreqScale = NaNToDefault(parseNumber(txtPlayFreqScale.value), defaultBlockNode.freqRatio);
	if(playerClip) playerClip.playFreqScale = playFreqScale;
	return true;
}
function playVolScaleChanged(event) {
	if(!window.txtPlayVolScale) return false;
	//if(txtPlayVolScale.valueAsNumber < 0) txtPlayVolScale.stepUp();
	playVolScale = NaNToDefault(parseNumber(txtPlayVolScale.value), defaultBlockNode.volRatio);
	if(playerClip) playerClip.playVolScale = playVolScale;
	return true;
}

function saveControlPreference(elem) {
	if(adjustingPreferences) return false; //breaks silently; no need to log this
	if(!elem) {
		console.info("saveControlPreference(): parameter elem is empty. Returning.");
		return false;
	}
	let prefKey = elem.dataset["pref"];
	if(!prefKey) return false;

	if(elem.tagName.toUpperCase() === "SELECT") {
		localStorage.setItem(prefKey, elem.value);
		return true;
	}
	if(elem.tagName.toUpperCase() === "INPUT") {
		if(elem.type.toUpperCase() === "CHECKBOX")
			localStorage.setItem(prefKey, JSON.stringify(elem.checked));
		else
			localStorage.setItem(prefKey, elem.value);
		return true;
	}
	if(elem.contentEditable.toUpperCase() == "TRUE" || elem.classList.contains("code-editor")) {
		//localStorage.setItem(prefKey, elem.innerText);
		localStorage.setItem(prefKey, codeEditorContentGet(elem));
		return true;
	}
	console.warn("Could not save a preference: exceptional control type.");
	return false;
}
function saveInputValue(event) {
	if(adjustingPreferences) return false;
	if(!event?.target) {
		console.info("saveInputValue(): parameter event.target is empty. Returning.");
		return false;
	}
	saveControlPreference(event.target);
}

const defStructuredCode = '{\n\
	"freqRatio": 440,\n\
	"volRatio": 0.5,\n\
	"timeDelta": 0,\n\
	"timeScale": 0.5,\n\
	"decayFactor": 128,\n\
	"attack": "1/64",\n\
	"pat1": [\n\
		{"noteStart": 0, "duration": 2, "freq": 2, "timbre": "noise", "decayFactor": 64},\n\
		{"noteStart": 0, "duration": 1, "freq": 1},\n\
		{"noteStart": 1, "duration": 1, "freq": "5/4"},\n\
		{"noteStart": 2, "duration": 1, "freq": [-1, 1]},\n\
		{"noteStart": 3, "noteStop": 4, "freq": {"2": -2, "7": 1}}\n\
	],\n\
	"0": {"freqRatio": 1, "timeDelta": 0, "vibratoDepth": 0.25, "vibratoAttack": 1, "0": "pat1", "remark": "asdfsf"},\n\
	"1": {"timeScale": 0.75, "freqRatio": 2, "timeDelta": 4, "portamento": 0.0625, "0": "pat1", "remark": 1234, "tag": "qwert"}\n\
}';
const defFlattenedCode = '[{"noteStart": 0, "noteStop": 2, "freq": 660, "vol": 0.375},\n\
{"noteStart": 2, "noteStop": 4, "freq": 440, "vol": 1}]';
function btnResetPreferencesClick(event) {
	//resetAllPreferences();
	try {
		adjustingPreferences = true;
		if(window.chkResetPageAppearance?.checked) {
			localStorage.removeItem("pageAppearance.textSize");
			localStorage.removeItem("pageAppearance.theme");
			localStorage.removeItem("pageAppearance.hue");

			textSize = 1;
			document.documentElement.style.setProperty("--page-scale", textSize);
			cboPageTheme.value = "Automatic";
			cboPageTheme.dispatchEvent(new Event("input"));
			document.documentElement.style.setProperty("--hue-accent0", 120);
			updateThemeColor(120);
		}
		if(window.chkResetGenParams?.checked) {
			localStorage.removeItem("genParams.baseFreq");
			localStorage.removeItem("genParams.freqRangeMin");
			localStorage.removeItem("genParams.freqRangeMax");
			localStorage.removeItem("genParams.patternCount");
			localStorage.removeItem("genParams.primeCount");
			localStorage.removeItem("genParams.expVariance");
			localStorage.removeItem("genParams.primeExpRanges");

			txtBaseFreq.value = defaultRootFreq.toString();
			txtBaseFreq.dispatchEvent(new Event("input"));
			txtFreqRangeMin.value = defaultFreqMin.toString();
			txtFreqRangeMin.dispatchEvent(new Event("input"));
			txtFreqRangeMax.value = defaultFreqMax.toString();
			txtFreqRangeMax.dispatchEvent(new Event("input"));
			txtTimeScale.value = "0.5";
			txtTimeScale.dispatchEvent(new Event("input"));
			txtPatternCount.value = "4";
			txtPatternCount.dispatchEvent(new Event("input"));
			txtPrimeCount.value = "3";
			txtPrimeCount.dispatchEvent(new Event("input"));
			txtExpVariance.value = "2";
			txtExpVariance.dispatchEvent(new Event("input"));
			recalcExpRanges(true);
		}
		if(window.chkResetRhythmParams?.checked) {
			localStorage.removeItem("rhythmParams.rhythmScale");
			localStorage.removeItem("rhythmParams.rhythmFactors");

			txtRhythmScale.value = "8";
			txtRhythmScale.dispatchEvent(new Event("input"));
			txtRhythmFactors.value = defaultRhythmFactors.join("*");
			txtRhythmFactors.dispatchEvent(new Event("input"));
		}
		if(window.chkResetAddGenParams?.checked) {
			localStorage.removeItem("addGenParams.voiceCount");
			localStorage.removeItem("addGenParams.reptCount");
			localStorage.removeItem("addGenParams.reptPeriod");
			localStorage.removeItem("addGenParams.percussivePattern");

			txtVoiceCount.value = "3";
			txtVoiceCount.dispatchEvent(new Event("input"));
			txtReptCount.value = "2";
			txtReptCount.dispatchEvent(new Event("input"));
			txtReptPeriod.value = "4";
			txtReptPeriod.dispatchEvent(new Event("input"));
			chkPercussivePattern.checked = true;
			chkPercussivePattern.dispatchEvent(new Event("click"));
		}
		if(window.chkResetStructuredMusic?.checked) {
			localStorage.removeItem("structuredMusic.overflow");
			localStorage.removeItem("structuredMusic.lineWrapping");
			localStorage.removeItem("structuredMusic.content");

			ctlStructuredScript.classList.remove("expanded");
			ctlStructuredScript.classList.remove("line-wrap");
			chkOverflow1.checked = false;
			chkLineWrap1.checked = false;
			codeEditorContentSet(ctlStructuredScript, defStructuredCode);
			ctlStructuredScript.classList.remove("invalid");
			//ctlStructuredScript.dispatchEvent(new Event("input"));
		}
		if(window.chkResetFlatScript?.checked) {
			localStorage.removeItem("flatScript.autoFlatten");
			localStorage.removeItem("flatScript.overflow");
			localStorage.removeItem("flatScript.lineWrapping");
			localStorage.removeItem("flatScript.content");

			chkAutoFlatten.checked = true;
			//chkAutoFlatten.dispatchEvent(new Event("click"));
			ctlFlatScript.classList.remove("expanded");
			ctlFlatScript.classList.remove("line-wrap");
			chkOverflow2.checked = false;
			chkLineWrap2.checked = false;
			codeEditorContentSet(ctlFlatScript, defFlattenedCode);
			ctlFlatScript.classList.remove("invalid");
			ctlFlatScript.dispatchEvent(new Event("input"));
		}
		if(window.chkResetClipParams?.checked) {
			localStorage.removeItem("clipParams.freqScale");
			localStorage.removeItem("clipParams.volScale");
			localStorage.removeItem("clipParams.timeScale");
			localStorage.removeItem("clipParams.timeDelta");

			txtPlayFreqScale.value = "1";
			txtPlayFreqScale.dispatchEvent(new Event("input"));
			txtPlayVolScale.value = "1";
			txtPlayVolScale.dispatchEvent(new Event("input"));
			txtPlayTimeScale.value = "1";
			txtPlayTimeScale.dispatchEvent(new Event("input"));
			txtPlayTimeDelta.value = "0";
			txtPlayTimeDelta.dispatchEvent(new Event("input"));
		}
		if(window.chkResetPlayer?.checked) {
			localStorage.removeItem("player.autoReload");

			chkAutoReload.checked = false;
			chkAutoReload.dispatchEvent(new Event("click"));
		}
		if(window.chkResetReset?.checked) {
			localStorage.removeItem("reset.pageAppearance");
			localStorage.removeItem("reset.genParams");
			localStorage.removeItem("reset.rhythmParams");
			localStorage.removeItem("reset.addGenParams");
			localStorage.removeItem("reset.structuredMusic");
			localStorage.removeItem("reset.flatScript");
			localStorage.removeItem("reset.clipParams");
			localStorage.removeItem("reset.player");
			localStorage.removeItem("reset.reset");

			if(window.chkResetPageAppearance) chkResetPageAppearance.checked = false;
			if(window.chkResetGenParams) chkResetGenParams.checked = false;
			if(window.chkResetRhythmParams) chkResetRhythmParams.checked = false;
			if(window.chkResetAddGenParams) chkResetAddGenParams.checked = false;
			if(window.chkResetStructuredMusic) chkResetStructuredMusic.checked = false;
			if(window.chkResetFlatScript) chkResetFlatScript.checked = false;
			if(window.chkResetClipParams) chkResetClipParams.checked = false;
			if(window.chkResetPlayer) chkResetPlayer.checked = false;
			chkResetReset.checked = false;
			//.dispatchEvent(new Event("input"));
		}
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to reset preferences. " + (error.message ?? error ?? ""), 3);
		return false;
	} finally {
		adjustingPreferences = false;
	}
	return true;
}
