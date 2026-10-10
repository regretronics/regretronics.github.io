"use strict";

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
//to do: what to follow (and when)? get a criterion for when or whether to use defaultBlockNode besides for structured code
const prefsDefault = {
	pageAppearance: {textSize: 1, theme: "Automatic", hue: 120},
	basicParams: {
		//I know the human ear is supposed to hear more than this, but it's already outside the ordinary. I can barely hear these extremes.
		freqRangeMin: 30, 
		freqRangeMax: 13000
	},
	genParams: {
		baseFreq: 440, 
		timeScale: 0.5/* defaultBlockNode.timeScale */, 
		voiceCount: 3, 
		patternCount: 4, 
		reptCount: 2, 
		reptPeriod: 4, 
		percussivePattern: true
	},
	primeFactors: {
		primeCount: 3, 
		expRangeLower: 0, 
		expRangeUpper: 2, 
		expRanges: {} //variability per prime factor (2, 3, 5, 7, ...); array of array of numbers. to be calculated.
	},
	rhythmParams: {
		rhythmScale: 8, 
		//rhythm structure data (hierarchy of factors)
		//question: choose a different default? (perhaps based on primeCount)
		rhythmFactors: [2, 2, 2]
	},
	structuredMusic: {overflow: false, lineWrapping: false, content: defStructuredCode},
	flatScript: {autoFlatten: true, overflow: false, lineWrapping: false, content: defFlattenedCode},
	clipParams: {
		freqScale: 1/* defaultBlockNode.freqRatio */, 
		volScale: 1/* defaultBlockNode.volRatio */, 
		timeScale: 1/* defaultBlockNode.timeScale */, 
		timeDelta: 0/* defaultBlockNode.timeDelta */
	},
	player: {autoReload: false},
	//audioExport: {},
	reset: {pageAppearance: false, basicParams: false, genParams: false, primeFactors: false, rhythmParams: false, structuredMusic: false, flatScript: false, clipParams: false, player: false, reset: false}
};
var prefs = structuredClone(prefsDefault);

var preferencesKeysFlat = { //filled automatically, with few exceptions
	"primeFactors.expRanges": "object",
	"rhythmParams.rhythmFactors": "object"
};
const preferencesKeysDeprecatedFlat = {
	"genParams.freqRangeMin": "basicParams.freqRangeMin",
	"genParams.freqRangeMax": "basicParams.freqRangeMax",
	"genParams.expVariance": "primeFactors.expRangeUpper",
	"genParams.primeCount": "primeFactors.primeCount",
	"genParams.expRangeLower": "primeFactors.expRangeLower",
	"genParams.expRangeUpper": "primeFactors.expRangeUpper",
	"genParams.primeExpRanges": "primeFactors.expRanges",
	"addGenParams.voiceCount": "genParams.voiceCount",
	"addGenParams.reptCount": "genParams.reptCount",
	"addGenParams.reptPeriod": "genParams.reptPeriod",
	"addGenParams.percussivePattern": "genParams.percussivePattern",
	"reset.addGenParams": null
};
/* const preferencesKeysTree = { //maybe generate automatically; maybe unnecessary
	pageAppearance: ["textSize", "theme", "hue"],
	basicParams: ["freqRangeMin", "freqRangeMax"],
	genParams: ["baseFreq", "timeScale", "voiceCount", "patternCount", "reptCount", "reptPeriod", "percussivePattern"],
	primeFactors: ["primeCount", "expRangeLower", "expRangeUpper", "expRanges"],
	rhythmParams: ["rhythmScale", "rhythmFactors"],
	structuredMusic: ["overflow", "lineWrapping", "content"],
	flatScript: ["autoFlatten", "overflow", "lineWrapping", "content"],
	clipParams: ["freqScale", "volScale", "timeScale", "timeDelta"],
	player: ["autoReload"],
	reset: ["pageAppearance", "basicParams", "genParams", "primeFactors", "rhythmParams", "structuredMusic", "flatScript", "clipParams", "player", "reset"]
}; */

//to do: rename rhythmFactorsAccum -> rhythmScales?
var 
	rhythmFactorsAccum = [], //to be calculated
	adjustingPreferences = false;

function getObjByPath(obj, path) {
	if(!obj) return obj;
	if(!path) return undefined;
	const keySegs = path.split(".");
	let subItem = obj;
	for(const seg of keySegs) {
		subItem = subItem[seg];
		if(subItem === undefined) return undefined;
	}
	return subItem;
}
function setObjByPath(obj, path, value, overwrite) {
	if(!obj || !path) return false;

	//parse path and traverse into obj
	const keySegs = path.split(".");
	let subObj = obj;
	for(const i in keySegs) {
		//if(!Object.hasOwn(keySegs, i)) continue; //probably unnecessary for arrays

		const seg = keySegs[i];
		if(i < keySegs.length - 1) {
			const isValObject = typeof(subObj[seg]) === "object";
			if(overwrite) {
				if(!isValObject) subObj[seg] = {};
			} else
				if(subObj[seg] === undefined)
					subObj[seg] = {};
				else
					if(!isValObject) return false;
			subObj = subObj[seg];
		} else //last level gets the value
			if(overwrite || subObj[seg] === undefined)
				subObj[seg] = value;
			else
				return false;
	}
	return true;
}

function ctlDefaultsToPrefs(targetObj) {
	//an alternative would be with a loop over prefs, and document.querySelectorAll(`[data-pref=${path}]`)
	for(const elem of document.querySelectorAll("[data-pref]"))
		try {
			const prefKey = elem.dataset?.pref;
			if(!prefKey || prefKey == "") continue;

			const value = controlGetDefault(elem);
			if(value)
				setObjByPath(targetObj, prefKey, value, true);
		} catch(error) {
			console.warn(error);
		}
	return true;
}
function prefsToCtlDefaults(prefs) {
	//an alternative would be with a loop over prefs, and document.querySelectorAll(`[data-pref=${path}]`)
	for(const elem of document.querySelectorAll("[data-pref]"))
		try {
			const prefKey = elem.dataset?.pref;
			if(!prefKey || prefKey == "") continue;

			const value = getObjByPath(prefs, prefKey);
			if(value !== undefined) controlSetDefault(elem, value);
		} catch(error) {
			console.warn(error);
		}
	return true;
}

/* function prefsToStorage(params) { //maybe unnecessary
} */
//note: traversal goes unchecked into objects if they are not already defined in preferencesKeysFlat.
function genPrefsKeysFlat() {
	//recursive function
	function prefsSubNodes(node, prefix) {
		//if(typeof(node) !== "object") return false;
		if(node == undefined) return false;
		if(typeof(node) !== "object") { //base case
			preferencesKeysFlat[prefix] = typeof(node);
			return true;
		}

		//if it's an object but there's already a type, stop delving and go back
		if(preferencesKeysFlat[prefix]) return true;

		if(prefix.length > 0) prefix += ".";
		for(const key of Object.keys(node)) {
			const item = node[key];
			//preferencesKeysFlat[prefix + "." + key] = typeof(item);
			prefsSubNodes(item, prefix + key);
		}
	}

	prefsSubNodes(prefsDefault, "");
	return true;
}
function storageToPrefs(targetObj) {
	function convertStoredValue(valueStr, type) {
		switch(type) {
			case "number":
				return NaNToDefault(Number(valueStr), undefined);
			case "boolean":
			case "object":
				valueStr ??= "";
				if(valueStr == "") return undefined;
				return JSON.parse(valueStr);
			//case "string":
			default:
				return valueStr;
		}
	}

	//an alternative would be using a classic for loop, localStorage.length and localStorage.key(i)
	const errorPrefs = [];
	for(const storageKey of Object.keys(localStorage))
		try {
			let valueType = preferencesKeysFlat[storageKey];
			if(valueType) {
				const value = convertStoredValue(localStorage[storageKey], valueType);
				if(value != undefined) setObjByPath(targetObj, storageKey, value, true);
			}
			else {
				const targetKey = preferencesKeysDeprecatedFlat[storageKey];
				if(targetKey) {
					valueType = preferencesKeysFlat[targetKey];
					const value = convertStoredValue(localStorage[storageKey], valueType);
					if(value != undefined) setObjByPath(targetObj, targetKey, value, false);
				}
			}
		} catch(error) {
			console.warn(error);
			errorPrefs.push(storageKey); //don't mutate the key list yet
		}

	for(const storageKey of errorPrefs)
		localStorage.removeItem(storageKey);
	return targetObj;
}

//note: this function doesn't try to trigger control events
function prefsToControls(prefs) {
	//an alternative would be with a loop over prefs, and document.querySelectorAll(`[data-pref=${path}]`)
	for(const elem of document.querySelectorAll("[data-pref]"))
		try {
			const prefKey = elem.dataset?.pref;
			if(!prefKey || prefKey == "") continue;

			const value = getObjByPath(prefs, prefKey);
			if(value !== undefined && typeof(value) !== "object") controlSetValue(elem, value);
		} catch(error) {
			console.warn(error);
		}
	return true;
}
/* function controlsToPrefs(params) { //maybe unnecessary
} */

//question: necessary?
function triggerPrefControls() {
	const evtInput = new Event("input"), evtClick = new Event("click");
	for(const elem of document.querySelectorAll("[data-pref]"))
		try {
			if(getObjByPath(prefs, elem.dataset?.pref)) continue;

			if(/* elem.tagName.toUpperCase() === "SELECT" 
				|| */ (elem.tagName.toUpperCase() === "INPUT" && elem.type.toLowerCase() === "checkbox"))
				elem.dispatchEvent(evtClick);
			else
				elem.dispatchEvent(evtInput);
		} catch(error) {
			console.warn(error);
		}
	return true;
}

//to do: !(doing) these functions will give way to the ones above that consistently convert from some point to another, using a preferences object for representation (one of the operands)
function loadAllPreferencesOld(triggerNow) { //to do: !change into simpler steps
	try {
		adjustingPreferences = true;
		let s;

		//Reset preferences (influences later conditionals)
		//to do: use triggerNow many more times
		if(!globalThis.chkResetReset?.checked) {
			if((s = localStorage.getItem("reset.pageAppearance")) && globalThis.chkResetPageAppearance) {
				chkResetPageAppearance.checked = JSON.parse(s);
				//chkResetPageAppearance.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.basicParams")) && globalThis.chkResetBasicParams) {
				chkResetBasicParams.checked = JSON.parse(s);
				//chkResetBasicParams.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.genParams")) && globalThis.chkResetGenParams) {
				chkResetGenParams.checked = JSON.parse(s);
				//chkResetGenParams.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.primeFactors")) && globalThis.chkResetPrimeFactorsParams) {
				chkResetPrimeFactorsParams.checked = JSON.parse(s);
				//chkResetPrimeFactorsParams.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.rhythmParams")) && globalThis.chkResetRhythmParams) {
				chkResetRhythmParams.checked = JSON.parse(s);
				//chkResetRhythmParams.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.structuredMusic")) && globalThis.chkResetStructuredMusic) {
				chkResetStructuredMusic.checked = JSON.parse(s);
				//chkResetStructuredMusic.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.flatScript")) && globalThis.chkResetFlatScript) {
				chkResetFlatScript.checked = JSON.parse(s);
				//chkResetFlatScript.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.clipParams")) && globalThis.chkResetClipParams) {
				chkResetClipParams.checked = JSON.parse(s);
				//chkResetClipParams.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.player")) && globalThis.chkResetPlayer) {
				chkResetPlayer.checked = JSON.parse(s);
				//chkResetPlayer.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("reset.reset")) && globalThis.chkResetReset) {
				chkResetReset.checked = JSON.parse(s);
				//chkResetReset.dispatchEvent(new Event("input"));
			}
		}

		//Page appearance
		if(!globalThis.chkResetPageAppearance?.checked) {
			if(s = localStorage.getItem("pageAppearance.textSize")) {
				prefs.pageAppearance.textSize = JSON.parse(s);
				//document.documentElement.style.fontSize = prefs.pageAppearance.textSize.toString() + "em";
				document.documentElement.style.setProperty("--page-scale", prefs.pageAppearance.textSize);
			}
			if((s = localStorage.getItem("pageAppearance.theme")) && globalThis.cboPageTheme) {
				cboPageTheme.value = s;
				cboPageTheme.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("pageAppearance.hue")) {
				const hue = parseNumber(JSON.parse(s)), hueMod = ((hue % 360) + 360) % 360;
				document.documentElement.style.setProperty("--hue-accent0", hueMod);
				//document.documentElement.style.setProperty("--hue-accent-init", hueMod);
				if(triggerNow) updateThemeColor(hueMod);
			}
		}

		//Basic parameters
		if(!globalThis.chkResetBasicParams?.checked) {
			if((s = localStorage.getItem("basicParams.freqRangeMin") ?? localStorage.getItem("genParams.freqRangeMin")) && globalThis.txtFreqRangeMin) {
				txtFreqRangeMin.value = s;
				txtFreqRangeMin.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("basicParams.freqRangeMax") ?? localStorage.getItem("genParams.freqRangeMax")) && globalThis.txtFreqRangeMax) {
				txtFreqRangeMax.value = s;
				txtFreqRangeMax.dispatchEvent(new Event("input"));
			}
		}

		//Generator parameters
		if(!globalThis.chkResetGenParams?.checked) {
			if((s = localStorage.getItem("genParams.baseFreq")) && globalThis.txtBaseFreq) {
				txtBaseFreq.value = s;
				txtBaseFreq.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("genParams.timeScale")) && globalThis.txtTimeScale) {
				txtTimeScale.value = s;
				txtTimeScale.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("genParams.voiceCount") ?? localStorage.getItem("addGenParams.voiceCount")) && globalThis.txtVoiceCount) {
				txtVoiceCount.value = s;
				txtVoiceCount.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("genParams.patternCount")) && globalThis.txtPatternCount) {
				txtPatternCount.value = s;
				txtPatternCount.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("genParams.reptCount") ?? localStorage.getItem("addGenParams.reptCount")) && globalThis.txtReptCount) {
				txtReptCount.value = s;
				txtReptCount.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("genParams.reptPeriod") ?? localStorage.getItem("addGenParams.reptPeriod")) && globalThis.txtReptPeriod) {
				txtReptPeriod.value = s;
				txtReptPeriod.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("genParams.percussivePattern") ?? localStorage.getItem("addGenParams.percussivePattern")) && globalThis.chkPercussivePattern) {
				chkPercussivePattern.checked = JSON.parse(s);
				chkPercussivePattern.dispatchEvent(new Event("click")); //question: input or click event for check boxes?
			}
		}

		//Prime factors parameters
		if(!globalThis.chkResetPrimeFactorsParams?.checked) {
			if((s = localStorage.getItem("primeFactors.primeCount") ?? localStorage.getItem("genParams.primeCount")) && globalThis.txtPrimeCount) {
				txtPrimeCount.value = s;
				txtPrimeCount.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("primeFactors.expRangeLower") ?? localStorage.getItem("genParams.expRangeLower")) && globalThis.txtExpRangeLower) {
				txtExpRangeLower.value = s;
				txtExpRangeLower.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("primeFactors.expRangeUpper") ?? localStorage.getItem("genParams.expRangeUpper") ?? localStorage.getItem("genParams.expVariance")) && globalThis.txtExpRangeUpper) {
				txtExpRangeUpper.value = s;
				txtExpRangeUpper.dispatchEvent(new Event("input"));
			}
			if(s = localStorage.getItem("primeFactors.expRanges") ?? localStorage.getItem("genParams.primeExpRanges")) {
				codeBoxContentSet(ctlPrimeExpRanges, s);
				globalThis.ctlPrimeExpRanges?.dispatchEvent?.(new Event("input"));
			} else
				expRangesFromParams(false);
		}

		//Rhythm parameters
		if(!globalThis.chkResetRhythmParams?.checked) {
			if((s = localStorage.getItem("rhythmParams.rhythmScale")) && globalThis.txtRhythmScale) {
				txtRhythmScale.value = s;
				txtRhythmScale.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("rhythmParams.rhythmFactors")) && globalThis.txtRhythmFactors) {
				txtRhythmFactors.value = s;
				txtRhythmFactors.dispatchEvent(new Event("input"));
			}
		}

		//Structured music editor
		if(!globalThis.chkResetStructuredMusic?.checked) {
			if(s = localStorage.getItem("structuredMusic.overflow")) {
				const parsed = JSON.parse(s);
				if(globalThis.chkOverflow1) chkOverflow1.checked = parsed;
				//chkOverflow1.dispatchEvent(new Event("input"));
				globalThis.ctlStructuredScript?.classList?.toggle?.("expanded", parsed);
			}
			if(s = localStorage.getItem("structuredMusic.lineWrapping")) {
				const parsed = JSON.parse(s);
				if(globalThis.chkLineWrap1) chkLineWrap1.checked = parsed;
				//chkLineWrap1.dispatchEvent(new Event("input"));
				globalThis.ctlStructuredScript?.classList?.toggle?.("line-wrap", parsed);
			}
			if(s = localStorage.getItem("structuredMusic.content")) {
				codeBoxContentSet(ctlStructuredScript, s);
				globalThis.ctlStructuredScript?.dispatchEvent?.(new Event("input"));
			}
		}

		//Flattened note list
		if(!globalThis.chkResetFlatScript?.checked) {
			if((s = localStorage.getItem("flatScript.autoFlatten")) && globalThis.chkAutoFlatten) {
				chkAutoFlatten.checked = JSON.parse(s);
				//chkAutoFlatten.dispatchEvent(new Event("click"));
			}
			if(s = localStorage.getItem("flatScript.overflow")) {
				const parsed = JSON.parse(s);
				if(globalThis.chkOverflow2) chkOverflow2.checked = parsed;
				//chkOverflow2.dispatchEvent(new Event("input"));
				globalThis.ctlFlatScript?.classList?.toggle?.("expanded", parsed);
			}
			if(s = localStorage.getItem("flatScript.lineWrapping")) {
				const parsed = JSON.parse(s);
				if(globalThis.chkLineWrap2) chkLineWrap2.checked = parsed;
				//chkLineWrap2.dispatchEvent(new Event("input"));
				globalThis.ctlFlatScript?.classList?.toggle?.("line-wrap", parsed);
			}
			if(s = localStorage.getItem("flatScript.content")) {
				codeBoxContentSet(ctlFlatScript, s);
				globalThis.ctlFlatScript?.dispatchEvent?.(new Event("input"));
			}
		}

		//Overall play controls
		if(!globalThis.chkResetClipParams?.checked) {
			if((s = localStorage.getItem("clipParams.freqScale")) && globalThis.txtPlayFreqScale) {
				txtPlayFreqScale.value = s;
				txtPlayFreqScale.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("clipParams.volScale")) && globalThis.txtPlayVolScale) {
				txtPlayVolScale.value = s;
				txtPlayVolScale.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("clipParams.timeScale")) && globalThis.txtPlayTimeScale) {
				txtPlayTimeScale.value = s;
				txtPlayTimeScale.dispatchEvent(new Event("input"));
			}
			if((s = localStorage.getItem("clipParams.timeDelta")) && globalThis.txtPlayTimeDelta) {
				txtPlayTimeDelta.value = s;
				txtPlayTimeDelta.dispatchEvent(new Event("input"));
			}
		}

		//Player
		if(!globalThis.chkResetPlayer?.checked) {
			if((s = localStorage.getItem("player.autoReload")) && globalThis.chkAutoReload) {
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

	for(const key of Object.keys(preferencesKeysDeprecatedFlat))
		localStorage.removeItem(key);

	return true;
}
function loadAllPreferences(triggerNow) { //to do: maybe remove triggerNow
	try {
		adjustingPreferences = true;

		//to do: reset-filtering
		storageToPrefs(prefs);
		for(const key of Object.keys(preferencesKeysDeprecatedFlat))
			localStorage.removeItem(key);

		prefsToControls(prefs);
		//exceptions to prefsToControls
		document.documentElement.style.setProperty("--page-scale", prefs.pageAppearance.textSize);
		const hue = prefs.pageAppearance.hue, hueMod = ((hue % 360) + 360) % 360;
		document.documentElement.style.setProperty("--hue-accent0", hueMod);
		//document.documentElement.style.setProperty("--hue-accent-init", hueMod);
		if(triggerNow) updateThemeColor(hueMod);
		if(prefs.primeFactors.expRanges) {
			if(globalThis.ctlPrimeExpRanges) {
				const objText = toJSONCodeAdjusted(prefs.primeFactors.expRanges);
				codeBoxContentSet(ctlPrimeExpRanges, objText);
			} /* else
				throw(new Error("Control ctlPrimeExpRanges not found.")); */
		} else
			expRangesFromParams(false);
		//to do: deal with the automatic extra 1 factor
		txtRhythmFactors.value = prefs.rhythmParams.rhythmFactors.join("*");
		globalThis.ctlStructuredScript?.classList?.toggle?.("expanded", prefs.structuredMusic.overflow);
		globalThis.ctlStructuredScript?.classList?.toggle?.("line-wrap", prefs.structuredMusic.lineWrapping);
		globalThis.ctlFlatScript?.classList?.toggle?.("expanded", prefs.flatScript.overflow);
		globalThis.ctlFlatScript?.classList?.toggle?.("line-wrap", prefs.flatScript.lineWrapping);

		if(triggerNow) return triggerPrefControls();
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to load preferences. " + (error.message ?? error ?? ""), 3);
		return false;
	} finally {
		adjustingPreferences = false;
	}
	return true;
}
//function currently unused
function saveAllPreferences() { //to do: !probably change into simpler steps
	for(const elem of document.querySelectorAll("[data-pref]"))
		try {
			saveControlPreference(elem);
		} catch(error) {
			console.warn(error);
		}

	//exceptions
	try {
		//Page appearance
		prefs.pageAppearance.textSize = parseNumber(getComputedStyle(document.documentElement).getPropertyValue("--page-scale"));
		localStorage.setItem("pageAppearance.textSize", JSON.stringify(prefs.pageAppearance.textSize));
		prefs.pageAppearance.hue = parseNumber(getComputedStyle(document.documentElement).getPropertyValue("--hue-accent0"));
		localStorage.setItem("pageAppearance.hue", JSON.stringify(prefs.pageAppearance.hue));

		//Basic parameters: nothing
		//Generator parameters: nothing
		//Prime factors parameters
		//if(globalThis.ctlPrimeExpRanges) ; //to do: update prefs.primeFactors.expRanges
		localStorage.setItem("primeFactors.expRanges", JSON.stringify(prefs.primeFactors.expRanges));

		//Rhythm parameters
		//if(globalThis.txtRhythmFactors) ; //to do: update prefs.rhythmParams.rhythmFactors
		//to do: deal with the automatic extra 1 factor
		localStorage.setItem("rhythmParams.rhythmFactors", JSON.stringify(prefs.rhythmParams.rhythmFactors));

		//Structured music editor
		/* if(globalThis.ctlStructuredScript?.classList?.contains) {
			prefs.structuredMusic.overflow = ctlStructuredScript.classList.contains("expanded");
			prefs.structuredMusic.lineWrapping = ctlStructuredScript.classList.contains("line-wrap");
			localStorage.setItem("structuredMusic.overflow", JSON.stringify(prefs.structuredMusic.overflow));
			localStorage.setItem("structuredMusic.lineWrapping", JSON.stringify(prefs.structuredMusic.lineWrapping));
		} */

		//Flattened note list
		/* if(globalThis.ctlFlatScript?.classList?.contains) {
			prefs.flatScript.overflow = ctlFlatScript.classList.contains("expanded");
			prefs.flatScript.lineWrapping = ctlFlatScript.classList.contains("line-wrap");
			localStorage.setItem("flatScript.overflow", JSON.stringify(prefs.flatScript.overflow));
			localStorage.setItem("flatScript.lineWrapping", JSON.stringify(prefs.flatScript.lineWrapping));
		} */

		//Overall play controls: nothing
		//Player: nothing
		//Audio export: coming soon
		//localStorage.setItem("audioExport.", JSON.stringify());
		//Reset preferences: nothing
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to bulk-save preferences. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}
function btnResetPreferencesClick(event) { //to do: !change into simpler steps
	//resetAllPreferences();
	//to do: point those things to prefsDefault instead of literals
	try {
		adjustingPreferences = true;
		if(globalThis.chkResetPageAppearance?.checked) {
			localStorage.removeItem("pageAppearance.textSize");
			localStorage.removeItem("pageAppearance.theme");
			localStorage.removeItem("pageAppearance.hue");

			prefs.pageAppearance.textSize = prefsDefault.pageAppearance.textSize;
			document.documentElement.style.setProperty("--page-scale", prefs.pageAppearance.textSize);
			cboPageTheme.value = prefsDefault.pageAppearance.theme;
			cboPageTheme.dispatchEvent(new Event("input"));
			document.documentElement.style.setProperty("--hue-accent0", prefsDefault.pageAppearance.hue);
			updateThemeColor(prefsDefault.pageAppearance.hue);
		}
		if(globalThis.chkResetBasicParams?.checked) {
			localStorage.removeItem("genParams.freqRangeMin"); //deprecated
			localStorage.removeItem("genParams.freqRangeMax"); //deprecated
			localStorage.removeItem("basicParams.freqRangeMin");
			localStorage.removeItem("basicParams.freqRangeMax");

			txtFreqRangeMin.value = prefsDefault.basicParams.freqRangeMin.toString();
			txtFreqRangeMin.dispatchEvent(new Event("input"));
			txtFreqRangeMax.value = prefsDefault.basicParams.freqRangeMax.toString();
			txtFreqRangeMax.dispatchEvent(new Event("input"));
		}
		if(globalThis.chkResetGenParams?.checked) {
			localStorage.removeItem("genParams.baseFreq");
			localStorage.removeItem("genParams.timeScale");
			localStorage.removeItem("addGenParams.voiceCount"); //deprecated
			localStorage.removeItem("genParams.voiceCount");
			localStorage.removeItem("genParams.patternCount");
			localStorage.removeItem("addGenParams.reptCount"); //deprecated
			localStorage.removeItem("addGenParams.reptPeriod"); //deprecated
			localStorage.removeItem("addGenParams.percussivePattern"); //deprecated
			localStorage.removeItem("genParams.reptCount");
			localStorage.removeItem("genParams.reptPeriod");
			localStorage.removeItem("genParams.percussivePattern");

			txtBaseFreq.value = prefsDefault.genParams.baseFreq.toString();
			txtBaseFreq.dispatchEvent(new Event("input"));
			txtTimeScale.value = prefsDefault.genParams.timeScale.toString();
			txtTimeScale.dispatchEvent(new Event("input"));
			txtVoiceCount.value = prefsDefault.genParams.voiceCount.toString();
			txtVoiceCount.dispatchEvent(new Event("input"));
			txtPatternCount.value = prefsDefault.genParams.patternCount.toString();
			txtPatternCount.dispatchEvent(new Event("input"));
			txtReptCount.value = prefsDefault.genParams.reptCount.toString();
			txtReptCount.dispatchEvent(new Event("input"));
			txtReptPeriod.value = prefsDefault.genParams.reptPeriod.toString();
			txtReptPeriod.dispatchEvent(new Event("input"));
			chkPercussivePattern.checked = prefsDefault.genParams.percussivePattern;
			chkPercussivePattern.dispatchEvent(new Event("click"));
		}
		if(globalThis.chkResetPrimeFactorsParams?.checked) {
			localStorage.removeItem("genParams.primeCount"); //deprecated
			localStorage.removeItem("genParams.expVariance"); //deprecated
			localStorage.removeItem("genParams.expRangeLower"); //deprecated
			localStorage.removeItem("genParams.expRangeUpper"); //deprecated
			localStorage.removeItem("genParams.primeExpRanges"); //deprecated
			localStorage.removeItem("primeFactors.primeCount");
			localStorage.removeItem("primeFactors.expVariance");
			localStorage.removeItem("primeFactors.expRangeLower");
			localStorage.removeItem("primeFactors.expRangeUpper");
			localStorage.removeItem("primeFactors.expRanges");

			txtPrimeCount.value = prefsDefault.primeFactors.primeCount.toString();
			txtPrimeCount.dispatchEvent(new Event("input"));
			txtExpRangeLower.value = prefsDefault.primeFactors.expRangeLower.toString();
			txtExpRangeLower.dispatchEvent(new Event("input"));
			txtExpRangeUpper.value = prefsDefault.primeFactors.expRangeUpper.toString();
			txtExpRangeUpper.dispatchEvent(new Event("input"));
			ctlPrimeExpRanges.classList.remove("expanded", "line-wrap", "invalid");
			expRangesFromParams(true);
		}
		if(globalThis.chkResetRhythmParams?.checked) {
			localStorage.removeItem("rhythmParams.rhythmScale");
			localStorage.removeItem("rhythmParams.rhythmFactors");

			txtRhythmScale.value = prefsDefault.rhythmParams.rhythmScale.toString();
			txtRhythmScale.dispatchEvent(new Event("input"));
			txtRhythmFactors.value = prefsDefault.rhythmParams.rhythmFactors.join("*");
			txtRhythmFactors.dispatchEvent(new Event("input"));
		}
		if(globalThis.chkResetStructuredMusic?.checked) {
			localStorage.removeItem("structuredMusic.overflow");
			localStorage.removeItem("structuredMusic.lineWrapping");
			localStorage.removeItem("structuredMusic.content");

			chkOverflow1.checked = prefsDefault.structuredMusic.overflow;
			chkLineWrap1.checked = prefsDefault.structuredMusic.lineWrapping;
			codeBoxContentSet(ctlStructuredScript, prefsDefault.structuredMusic.content);
			ctlStructuredScript.classList.remove("expanded", "line-wrap", "invalid");
			//ctlStructuredScript.dispatchEvent(new Event("input"));
		}
		if(globalThis.chkResetFlatScript?.checked) {
			localStorage.removeItem("flatScript.autoFlatten");
			localStorage.removeItem("flatScript.overflow");
			localStorage.removeItem("flatScript.lineWrapping");
			localStorage.removeItem("flatScript.content");

			chkAutoFlatten.checked = prefsDefault.flatScript.autoFlatten;
			//chkAutoFlatten.dispatchEvent(new Event("click"));
			chkOverflow2.checked = prefsDefault.flatScript.overflow;
			chkLineWrap2.checked = prefsDefault.flatScript.lineWrapping;
			codeBoxContentSet(ctlFlatScript, prefsDefault.flatScript.content);
			ctlFlatScript.classList.remove("expanded", "line-wrap", "invalid");
			ctlFlatScript.dispatchEvent(new Event("input"));
		}
		if(globalThis.chkResetClipParams?.checked) {
			localStorage.removeItem("clipParams.freqScale");
			localStorage.removeItem("clipParams.volScale");
			localStorage.removeItem("clipParams.timeScale");
			localStorage.removeItem("clipParams.timeDelta");

			txtPlayFreqScale.value = prefsDefault.clipParams.freqScale.toString();
			txtPlayFreqScale.dispatchEvent(new Event("input"));
			txtPlayVolScale.value = prefsDefault.clipParams.volScale.toString();
			txtPlayVolScale.dispatchEvent(new Event("input"));
			txtPlayTimeScale.value = prefsDefault.clipParams.timeScale.toString();
			txtPlayTimeScale.dispatchEvent(new Event("input"));
			txtPlayTimeDelta.value = prefsDefault.clipParams.timeDelta.toString();
			txtPlayTimeDelta.dispatchEvent(new Event("input"));
		}
		if(globalThis.chkResetPlayer?.checked) {
			localStorage.removeItem("player.autoReload");

			chkAutoReload.checked = prefsDefault.player.autoReload;
			chkAutoReload.dispatchEvent(new Event("click"));
		}
		if(globalThis.chkResetReset?.checked) {
			localStorage.removeItem("reset.pageAppearance");
			localStorage.removeItem("reset.basicParams");
			localStorage.removeItem("reset.genParams");
			localStorage.removeItem("reset.primeFactors");
			localStorage.removeItem("reset.rhythmParams");
			localStorage.removeItem("reset.addGenParams"); //deprecated
			localStorage.removeItem("reset.structuredMusic");
			localStorage.removeItem("reset.flatScript");
			localStorage.removeItem("reset.clipParams");
			localStorage.removeItem("reset.player");
			localStorage.removeItem("reset.reset");

			if(globalThis.chkResetPageAppearance) chkResetPageAppearance.checked = prefsDefault.reset.pageAppearance;
			if(globalThis.chkResetBasicParams) chkResetBasicParams.checked = prefsDefault.reset.basicParams;
			if(globalThis.chkResetGenParams) chkResetGenParams.checked = prefsDefault.reset.genParams;
			if(globalThis.chkResetPrimeFactorsParams) chkResetPrimeFactorsParams.checked = prefsDefault.reset.primeFactors;
			if(globalThis.chkResetRhythmParams) chkResetRhythmParams.checked = prefsDefault.reset.rhythmParams;
			if(globalThis.chkResetStructuredMusic) chkResetStructuredMusic.checked = prefsDefault.reset.structuredMusic;
			if(globalThis.chkResetFlatScript) chkResetFlatScript.checked = prefsDefault.reset.flatScript;
			if(globalThis.chkResetClipParams) chkResetClipParams.checked = prefsDefault.reset.clipParams;
			if(globalThis.chkResetPlayer) chkResetPlayer.checked = prefsDefault.reset.player;
			chkResetReset.checked = prefsDefault.reset.reset;
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
//function currently out of use
function resetAllPreferences() {
	localStorage.clear();
	loadAllPreferences(); //?
}

//from individual control to prefs object and to localStorage
function saveControlPreference(elem) {
	//if(adjustingPreferences) return false; //breaks silently; no need to log this
	if(!elem) {
		console.info("saveControlPreference(): parameter elem is empty. Returning.");
		return false;
	}
	let prefKey = elem.dataset?.pref;
	if(!prefKey) return false;

	let value = controlGetValue(elem);
	if(value === undefined) {
		console.warn("Could not save a preference: exceptional control type.");
		return false;
	}

	const valueType = preferencesKeysFlat[prefKey];
	if(valueType === "object") return false;

	if(valueType === "number") value = NaNToDefault(parseNumber(value), getObjByPath(prefsDefault, prefKey));
	setObjByPath(prefs, prefKey, value, true);
	if(typeof(value) === "string")
		localStorage.setItem(prefKey, value);
	else
		localStorage.setItem(prefKey, JSON.stringify(value));
	return true;
}
function saveInputValue(event) {
	if(adjustingPreferences) return false;
	if(!event?.target) {
		console.info("saveInputValue(): parameter event.target is empty. Returning.");
		return false;
	}
	saveControlPreference(event.target);
}

function rescaleText(event) {
	if(!document || !document.documentElement || !document.documentElement.style) return false;
	const elem = event.target;
	if(!elem) {
		console.info("rescaleText(): parameter event.target is empty. Returning.");
		return false;
	}
	const f = Number(elem.dataset["factor"]);
	let newTextSize = prefs.pageAppearance.textSize * f;
	const strTextSize = newTextSize.toPrecision(5);
	newTextSize = Number(strTextSize);
	//document.documentElement.style.fontSize = newTextSize.toString() + "em"; //html element
	document.documentElement.style.setProperty("--page-scale", newTextSize);
	prefs.pageAppearance.textSize = newTextSize;

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
	//to do: !convert to oklch
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
	return true;
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

function updatePrimeList() {
	const lastPrime = Math.ceil(prefs.primeFactors.primeCount), primesList = primes.slice(0, lastPrime);
	//for fractional sizes, represent the last prime in a different way
	if(prefs.primeFactors.primeCount % 1 > 0) primesList[lastPrime - 1] = `<span class="partial">${primesList[lastPrime - 1]}</span>`;
	//if(globalThis.outPrimeList) outPrimeList.innerText = "[" + primesList.join(", ") + "]";
	if(globalThis.outPrimeList) outPrimeList.innerHTML = "[" + primesList.join(", ") + "]";
}
function primeCountChanged(event) {
	if(!globalThis.txtPrimeCount) return false;

	//question: reject value, correct it, or set to default?
	const newPrimeCount = parseNumber(txtPrimeCount.value); //reject it
	if(isNaN(newPrimeCount) || newPrimeCount < 1.25 || newPrimeCount > primes.length) return false;
	/* let newPrimeCount = NaNToDefault(parseNumber(txtPrimeCount.value), prefsDefault.primeFactors.primeCount); //correct it
	if(newPrimeCount < 1.25) newPrimeCount = 1.25;
	if(newPrimeCount > primes.length) newPrimeCount = primes.length; */
	prefs.primeFactors.primeCount = newPrimeCount;

	updatePrimeList();
	expRangesFromParams();
	return true;
}
function txtExpRangeLowerChanged(event) {
	if(!globalThis.txtExpRangeLower) return false;

	//question: reject value, correct it, or set to default?
	const newExpRangeLower = parseNumber(txtExpRangeLower.value); //reject it
	if(isNaN(newExpRangeLower)) {
		txtExpRangeLower.setCustomValidity("Input not recognized as a real number.");
		txtExpRangeLower.classList.add("invalid");
		return false;
	}
	if(newExpRangeLower < -8 || newExpRangeLower >= prefs.primeFactors.expRangeUpper) {
		txtExpRangeLower.setCustomValidity("Input is out of valid bounds.");
		txtExpRangeLower.classList.add("invalid");
		return false;
	}
	/* let newExpRangeLower = NaNToDefault(parseNumber(txtExpRangeLower.value), prefsDefault.primeFactors.expRangeLower); //correct it
	if(newExpRangeLower < -8) newExpRangeLower = -8;
	if(newExpRangeLower >= prefs.primeFactors.expRangeUpper) newExpRangeLower = prefs.primeFactors.expRangeUpper - Number(txtExpRangeLower.step); */
	prefs.primeFactors.expRangeLower = newExpRangeLower;
	txtExpRangeLower.setCustomValidity("");
	txtExpRangeLower.classList.remove("invalid");

	expRangesFromParams();
}
function txtExpRangeUpperChanged(event) {
	if(!globalThis.txtExpRangeUpper) return false;

	//question: reject value, correct it, or set to default?
	const newExpRangeUpper = parseNumber(txtExpRangeUpper.value); //reject it
	if(isNaN(newExpRangeUpper)) {
		txtExpRangeUpper.setCustomValidity("Input not recognized as a real number.");
		txtExpRangeUpper.classList.add("invalid");
		return false;
	}
	if(newExpRangeUpper <= prefs.primeFactors.expRangeLower || newExpRangeUpper > 8) {
		txtExpRangeUpper.setCustomValidity("Input is out of valid bounds.");
		txtExpRangeUpper.classList.add("invalid");
		return false;
	}
	/* let newExpRangeUpper = NaNToDefault(parseNumber(txtExpRangeUpper.value), prefsDefault.primeFactors.expRangeUpper); //correct it
	if(newExpRangeUpper <= prefsDefault.primeFactors.expRangeUpper) newExpRangeUpper = prefsDefault.primeFactors.expRangeUpper + Number(txtExpRangeUpper.step);
	if(newExpRangeUpper > 8) newExpRangeUpper = 8; */
	prefs.primeFactors.expRangeUpper = newExpRangeUpper;
	txtExpRangeUpper.setCustomValidity("");
	txtExpRangeUpper.classList.remove("invalid");

	expRangesFromParams();
}
//apart from recreating prefs.primeFactors.expRanges, this routine also updates the code box (ctlPrimeExpRanges) and localStorage
function expRangesFromParams(force) {
	if(adjustingPreferences && !force) return false; //fails silently
	//prefs.primeFactors.primeCount = NaNToDefault(parseNumber(txtPrimeCount.value), prefsDefault.primeFactors.primeCount);
	const 
		primeCount = prefs.primeFactors.primeCount, 
		expRangeLower = prefs.primeFactors.expRangeLower,
		expRangeUpper = prefs.primeFactors.expRangeUpper;

	try {
		const primeCountCeil = Math.ceil(primeCount);
		//const newExpRanges = new Array(primeCountCeil);
		const newExpRanges = {};
		//build table of exponent variance per prime factor (tonality limitation: high factors are too odd, and should have low exponents)
		for(let i = 0; i < primeCountCeil; i++) {
			const 
				varFraction = (i <= (primeCount - 1) ? 1 : (primeCount % 1)), 
				range = varFraction / Math.log2(primes[i]);

			newExpRanges[primes[i]] = [Number((expRangeLower * range).toFixed(4)), Number((expRangeUpper * range).toFixed(4))];
		}
		prefs.primeFactors.expRanges = newExpRanges;

		if(globalThis.ctlPrimeExpRanges) {
			const objText = toJSONCodeAdjusted(newExpRanges);
			codeBoxContentSet(ctlPrimeExpRanges, objText);
			//saveControlPreference(ctlPrimeExpRanges);
		} else
			throw(new Error("Control ctlPrimeExpRanges not found."));
		if(!adjustingPreferences) localStorage.setItem("primeFactors.expRanges", JSON.stringify(newExpRanges));
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to refresh exponent variance ranges. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}

function baseFreqChanged(event) {
	if(!globalThis.txtBaseFreq) return false;

	//question: reject value, correct it (freqRangeMin..freqRangeMax), or set to default?
	let newBaseFreq = parseNumber(txtBaseFreq.value);
	if(isNaN(newBaseFreq)) return false; //reject it
	//newBaseFreq = NaNToDefault(newBaseFreq, prefsDefault.genParams.baseFreq); //correct it
	if(newBaseFreq < prefs.basicParams.freqRangeMin) newBaseFreq = prefs.basicParams.freqRangeMin; //correct it
	if(newBaseFreq > prefs.basicParams.freqRangeMax) newBaseFreq = prefs.basicParams.freqRangeMax;

	globalThis.txtBaseFreq?.classList?.toggle?.("invalid", !newBaseFreq);
	if(!newBaseFreq) {
		globalThis.txtBaseFreq?.setCustomValidity("Base frequency shouldn't be 0.");
		prefs.genParams.baseFreq = prefsDefault.genParams.baseFreq; //set to default
	} else {
		globalThis.txtBaseFreq?.setCustomValidity("");
		prefs.genParams.baseFreq = newBaseFreq;
	}

	return true;
}
//to do: handler for frequency extremes, calling updateVisAreaTransform()? (currently, changing the thresholds during play requires pause-toggling for visualizer updating)

function rhythmFactorsChanged(event) {
	//to do: !support additive time signatures (e.g. 3 beats + 4 beats -> 1001000)? (would probably turn rhythmFactors into a tree)
	//	to do: !how should we interpret a heterogeneous number of factors, e.g. 3 + 2*2 (top-down vs. bottom-up)? like (2 + 2 + 2) + ((1 + 1) + (1 + 1)) or (1 + 1 + 1) + ((1 + 1) + (1 + 1))?
	//		pad with factors? e.g. 3 + 2*2 -> 1*3 + 2*2
	//		maybe bottom-up: 3 + 2*2 would be like 3*1 + 2*2. seems conceptually simpler.
	//to do: support rational numbers (e.g. 4/3 beats) without reducing to floats?
	//to do: !maybe interpret the rightmost factor (deepest into the small scale) as a duration in pulses, not a group of pulses, which would change the number of levels (2 * 2 would have 4/2 as levels, instead of 4/2/1)
	if(!globalThis.txtRhythmFactors) return false;
	let s = txtRhythmFactors.value.toString(); //text
	const newRhythmFactors = []; //will become an array of numbers
	if(s.length >= 1) {
		s = exprEliminateParens(s).split("*"); //multiplications inside parens won't be parsed as rhythmic levels
		for(const n of s) {
			//expand powers (e.g. 2^3 -> 2*2*2 -> [2, 2, 2], not [8])
			const pos = n.indexOf("^");
			if(pos >= 0) {
				const base = NaNToDefault(parseNumber(n.slice(0, pos)), 2);
				for(let exp = NaNToDefault(parseNumber(n.slice(pos + 1)), 1); exp >= 1; exp--)
					newRhythmFactors.push(base);
				//question: non-integer exponents? (if(exp > 0) ...)
				//question: negative exponents?
			} else
				newRhythmFactors.push((n.length < 1) ? 1 : parseNumber(n));
		}
	}
	//to do: invalidate factors below 1? and negative factors?
	//note: empty structures now allowed
	try {
		if(newRhythmFactors.some(x => x == 0)) //has zeroes?
			throw(new Error("Rhythm factors can't include zero."));

		if(newRhythmFactors.some(x => isNaN(x))) //unparsed expressions?
			throw(new Error("Unrecognized numerical expression in rhythm formula."));

		txtRhythmFactors.classList.remove("invalid");
		txtRhythmFactors.setCustomValidity("");
	} catch(error) {
		console.error(error);
		//default/fallback
		//prefs.rhythmParams.rhythmFactors = prefsDefault.rhythmParams.rhythmFactors;
		txtRhythmFactors?.classList?.add?.("invalid");
		txtRhythmFactors?.setCustomValidity?.(error.toString());
		return false;
	}

	prefs.rhythmParams.rhythmFactors = newRhythmFactors;
	if(!adjustingPreferences) localStorage.setItem("rhythmParams.rhythmFactors", JSON.stringify(newRhythmFactors));
	updateRhythmAccum();
	return true;
}

function playFreqScaleChanged(event) {
	if(!globalThis.txtPlayFreqScale) return false;
	//if(txtPlayFreqScale.valueAsNumber <= 0) txtPlayFreqScale.stepUp();
	prefs.clipParams.freqScale = NaNToDefault(parseNumber(txtPlayFreqScale.value), /* defaultBlockNode.freqRatio */prefsDefault.clipParams.freqScale);
	if(playerClip) playerClip.playFreqScale = prefs.clipParams.freqScale;
	return true;
}
function playVolScaleChanged(event) {
	if(!globalThis.txtPlayVolScale) return false;
	//if(txtPlayVolScale.valueAsNumber < 0) txtPlayVolScale.stepUp();
	prefs.clipParams.volScale = NaNToDefault(parseNumber(txtPlayVolScale.value), /* defaultBlockNode.volRatio */prefsDefault.clipParams.volScale);
	if(playerClip) playerClip.playVolScale = prefs.clipParams.volScale;
	return true;
}
