"use strict";

var primeCount = 2, expVariance = 2;
var autoFlatten = true;

//persistence feature under construction
var adjustingPreferences = false;
function loadPreferences() {
	try {
		adjustingPreferences = true;
		let s;

		//Page appearance
		s = localStorage.getItem("pageAppearance.textSize");
		if(s) {
			textSize = JSON.parse(s);
			//document.documentElement.style.fontSize = textSize.toString() + "em";
			document.documentElement.style.setProperty("--page-scale", textSize);
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
			txtBaseFreq.value = JSON.parse(s);
			txtBaseFreq.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.timeScale");
		if(s) {
			txtTimeScale.value = JSON.parse(s);
			txtTimeScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.patternCount");
		if(s) {
			txtPatternCount.value = JSON.parse(s);
			txtPatternCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.primeCount");
		if(s) {
			txtPrimeCount.value = JSON.parse(s);
			txtPrimeCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("genParams.expVariance");
		if(s) {
			txtExpVariance.value = JSON.parse(s);
			txtExpVariance.dispatchEvent(new Event("input"));
		}
		
		//Rhythm parameters
		s = localStorage.getItem("rhythmParams.rhythmScale");
		if(s) {
			txtRhythmScale.value = JSON.parse(s);
			txtRhythmScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("rhythmParams.rhythmFactors");
		if(s) {
			txtRhythmFactors.value = JSON.parse(s);
			txtRhythmFactors.dispatchEvent(new Event("input"));
		}

		//Additional generator parameters
		s = localStorage.getItem("addGenParams.voiceCount");
		if(s) {
			txtVoiceCount.value = JSON.parse(s);
			txtVoiceCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("addGenParams.reptCount");
		if(s) {
			txtReptCount.value = JSON.parse(s);
			txtReptCount.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("addGenParams.reptPeriod");
		if(s) {
			txtReptPeriod.value = JSON.parse(s);
			txtReptPeriod.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("addGenParams.percussivePattern");
		if(s) {
			chkPercussivePattern.checked = JSON.parse(s);
			chkPercussivePattern.dispatchEvent(new Event("click")); //question: input or click event for check boxes?
		}

		//Structured music editor
		s = localStorage.getItem("structuredMusic.overflow");
		if(s) {
			if(JSON.parse(s))
				ctlStructuredScript.classList.add("expanded");
			else
				ctlStructuredScript.classList.remove("expanded");
		}
		s = localStorage.getItem("structuredMusic.lineWrapping");
		if(s) {
			if(JSON.parse(s))
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
			chkAutoFlatten.dispatchEvent(new Event("click"));
		}
		s = localStorage.getItem("flatScript.overflow");
		if(s) {
			if(JSON.parse(s))
				ctlFlatScript.classList.add("expanded");
			else
				ctlFlatScript.classList.remove("expanded");
		}
		s = localStorage.getItem("flatScript.lineWrapping");
		if(s) {
			if(JSON.parse(s))
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
			txtPlayFreqScale.value = JSON.parse(s);
			txtPlayFreqScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("clipParams.volScale");
		if(s) {
			txtPlayVolScale.value = JSON.parse(s);
			txtPlayVolScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("clipParams.timeScale");
		if(s) {
			txtPlayTimeScale.value = JSON.parse(s);
			txtPlayTimeScale.dispatchEvent(new Event("input"));
		}
		s = localStorage.getItem("clipParams.timeDelta");
		if(s) {
			txtPlayTimeDelta.value = JSON.parse(s);
			txtPlayTimeDelta.dispatchEvent(new Event("input"));
		}

		//Player
		s = localStorage.getItem("player.autoReload");
		if(s) {
			chkAutoReload.checked = JSON.parse(s);
			chkAutoReload.dispatchEvent(new Event("click"));
		}

		//Audio export
		//s = localStorage.getItem("audioExport.");

		//Reset preferences
		/* s = localStorage.getItem("reset.pageAppearance");
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
		s = localStorage.getItem("reset.player");
		if(s) {
			chkResetReset.valueAsNumber = JSON.parse(s);
			chkResetReset.dispatchEvent(new Event("input"));
		} */
	} finally {
		adjustingPreferences = false;
	}
}
function savePreferences() {
	//Page appearance
	localStorage.setItem("pageAppearance.textSize", JSON.stringify(textSize)); //getComputedStyle(document.documentElement).getPropertyValue("--page-scale")?
	localStorage.setItem("pageAppearance.theme", JSON.stringify(cboPageTheme.value));
	localStorage.setItem("pageAppearance.hue", JSON.stringify(getComputedStyle(document.documentElement).getPropertyValue("--hue-accent")));
	
	//Generator parameters
	localStorage.setItem("genParams.baseFreq", JSON.stringify(txtBaseFreq.value)); //rootFreq?
	localStorage.setItem("genParams.timeScale", JSON.stringify(txtTimeScale.value)); //txtTimeScale
	localStorage.setItem("genParams.patternCount", JSON.stringify(txtPatternCount.value)); //txtPatternCount
	localStorage.setItem("genParams.primeCount", JSON.stringify(primeCount)); //txtPrimeCount?
	localStorage.setItem("genParams.expVariance", JSON.stringify(expVariance)); //txtExpVariance?
	
	//Rhythm parameters
	localStorage.setItem("rhythmParams.rhythmScale", JSON.stringify(txtRhythmScale.value));
	localStorage.setItem("rhythmParams.rhythmFactors", JSON.stringify(txtRhythmFactors.value)); //rhythmFactors?
	//Additional generator parameters
	localStorage.setItem("addGenParams.voiceCount", JSON.stringify(txtVoiceCount.value));
	localStorage.setItem("addGenParams.reptCount", JSON.stringify(txtReptCount.value));
	localStorage.setItem("addGenParams.reptPeriod", JSON.stringify(txtReptPeriod.value));
	localStorage.setItem("addGenParams.percussivePattern", JSON.stringify(chkPercussivePattern.checked));
	//Structured music editor
	localStorage.setItem("structuredMusic.overflow", JSON.stringify(ctlStructuredScript.classList.contains("expanded")));
	localStorage.setItem("structuredMusic.lineWrapping", JSON.stringify(ctlStructuredScript.classList.contains("lineWrapping")));
	localStorage.setItem("structuredMusic.content", JSON.stringify(ctlStructuredScript.innerText));
	//Flattened note list
	localStorage.setItem("flatScript.autoFlatten", JSON.stringify(chkAutoFlatten));
	localStorage.setItem("flatScript.overflow", JSON.stringify(ctlFlatScript.classList.contains("expanded")));
	localStorage.setItem("flatScript.lineWrapping", JSON.stringify(ctlFlatScript.classList.contains("lineWrapping")));
	localStorage.setItem("flatScript.content", JSON.stringify(ctlFlatScript.innerText));
	//Overall play controls
	localStorage.setItem("clipParams.freqScale", JSON.stringify(playFreqScale)); //txtPlayFreqScale?
	localStorage.setItem("clipParams.volScale", JSON.stringify(playVolScale)); //txtPlayVolScale?
	localStorage.setItem("clipParams.timeScale", JSON.stringify(txtPlayTimeScale.value));
	localStorage.setItem("clipParams.timeDelta", JSON.stringify(txtPlayTimeDelta.value));
	//Player
	localStorage.setItem("player.autoReload", JSON.stringify(chkAutoReload.checked));
	/*
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
	//document.documentElement.style.fontSize = textSize.toString() + "em"; //html element
	document.documentElement.style.setProperty("--page-scale", textSize);

	localStorage.setItem("pageAppearance.textSize", JSON.stringify(textSize));
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

	localStorage.setItem("pageAppearance.hue", JSON.stringify(hue));
}

function primeCountChanged() {
	if(!txtPrimeCount) return false;
	primeCount = NaNToDefault(parseNumber(txtPrimeCount.value), 2);
	if(primeCount < 2) primeCount = 2;
	if(outPrimeList) outPrimeList.innerText = "(" + primes.slice(0, primeCount).join(",") + ")";
}

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

function saveInputValue(event) {
	if(adjustingPreferences) return;
	if(!event?.target) return;
	let prefKey = event.target.dataset["pref"];
	if(!prefKey) return;

	if(event.target.tagName.toUpperCase() === "SELECT") {
		localStorage.setItem(prefKey, JSON.stringify(event.target.value));
		return;
	}
	if(event.target.tagName.toUpperCase() === "INPUT") {
		if(event.target.type.toUpperCase() === "CHECKBOX")
			localStorage.setItem(prefKey, JSON.stringify(event.target.checked));
		else
			localStorage.setItem(prefKey, JSON.stringify(event.target.value));
		return;
	}
	if(event.target.contentEditable.toUpperCase() == "TRUE" || event.target.classList.contains("codeEditor")) {
		localStorage.setItem(prefKey, JSON.stringify(event.target.innerText));
		return;
	}
	console.warn("Could not save a preference: exceptional control type.");
}
