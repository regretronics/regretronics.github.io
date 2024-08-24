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
			s = localStorage.getItem("reset.pageAppearance");
			if(s) {
				chkResetPageAppearance.checked = JSON.parse(s);
				//chkResetPageAppearance.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.genParams");
			if(s) {
				chkResetGenParams.checked = JSON.parse(s);
				//chkResetGenParams.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.rhythmParams");
			if(s) {
				chkResetRhythmParams.checked = JSON.parse(s);
				//chkResetRhythmParams.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.addGenParams");
			if(s) {
				chkResetAddGenParams.checked = JSON.parse(s);
				//chkResetAddGenParams.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.structuredMusic");
			if(s) {
				chkResetStructuredMusic.checked = JSON.parse(s);
				//chkResetStructuredMusic.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.flatScript");
			if(s) {
				chkResetFlatScript.checked = JSON.parse(s);
				//chkResetFlatScript.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.clipParams");
			if(s) {
				chkResetClipParams.checked = JSON.parse(s);
				//chkResetClipParams.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.player");
			if(s) {
				chkResetPlayer.checked = JSON.parse(s);
				//chkResetPlayer.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("reset.reset");
			if(s) {
				chkResetReset.checked = JSON.parse(s);
				//chkResetReset.dispatchEvent(new Event("input"));
			}
		}

		//Page appearance
		if(!chkResetPageAppearance.checked) {
			s = localStorage.getItem("pageAppearance.textSize");
			if(s) {
				textSize = JSON.parse(s);
				//document.documentElement.style.fontSize = textSize.toString() + "em";
				document.documentElement.style.setProperty("--page-scale", textSize);
			}
			s = localStorage.getItem("pageAppearance.theme");
			if(s) {
				cboPageTheme.value = s;
				cboPageTheme.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("pageAppearance.hue");
			if(s) {
				document.documentElement.style.setProperty("--hue-accent", JSON.parse(s));
			}
		}

		//Generator parameters
		if(!chkResetGenParams.checked) {
			s = localStorage.getItem("genParams.baseFreq");
			if(s) {
				txtBaseFreq.value = s;
				txtBaseFreq.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("genParams.timeScale");
			if(s) {
				txtTimeScale.value = s;
				txtTimeScale.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("genParams.patternCount");
			if(s) {
				txtPatternCount.value = s;
				txtPatternCount.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("genParams.primeCount");
			if(s) {
				txtPrimeCount.value = s;
				txtPrimeCount.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("genParams.expVariance");
			if(s) {
				txtExpVariance.value = s;
				txtExpVariance.dispatchEvent(new Event("input"));
			}
		}
		
		//Rhythm parameters
		if(!chkResetRhythmParams.checked) {
			s = localStorage.getItem("rhythmParams.rhythmScale");
			if(s) {
				txtRhythmScale.value = s;
				txtRhythmScale.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("rhythmParams.rhythmFactors");
			if(s) {
				txtRhythmFactors.value = s;
				txtRhythmFactors.dispatchEvent(new Event("input"));
			}
		}

		//Additional generator parameters
		if(!chkResetAddGenParams.checked) {
			s = localStorage.getItem("addGenParams.voiceCount");
			if(s) {
				txtVoiceCount.value = s;
				txtVoiceCount.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("addGenParams.reptCount");
			if(s) {
				txtReptCount.value = s;
				txtReptCount.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("addGenParams.reptPeriod");
			if(s) {
				txtReptPeriod.value = s;
				txtReptPeriod.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("addGenParams.percussivePattern");
			if(s) {
				chkPercussivePattern.checked = JSON.parse(s);
				chkPercussivePattern.dispatchEvent(new Event("click")); //question: input or click event for check boxes?
			}
		}

		//Structured music editor
		if(!chkResetStructuredMusic.checked) {
			s = localStorage.getItem("structuredMusic.overflow");
			if(s) {
				chkOverflow1.checked = JSON.parse(s);
				//chkOverflow1.dispatchEvent(new Event("input"));
				if(JSON.parse(s))
					ctlStructuredScript.classList.add("expanded");
				else
					ctlStructuredScript.classList.remove("expanded");
			}
			s = localStorage.getItem("structuredMusic.lineWrapping");
			if(s) {
				chkLineWrap1.checked = JSON.parse(s);
				//chkLineWrap1.dispatchEvent(new Event("input"));
				if(JSON.parse(s))
					ctlStructuredScript.classList.add("lineWrapping");
				else
					ctlStructuredScript.classList.remove("lineWrapping");
			}
			s = localStorage.getItem("structuredMusic.content");
			if(s) {
				ctlStructuredScript.innerText = s;
				ctlStructuredScript.dispatchEvent(new Event("input"));
			}
		}

		//Flattened note list
		if(!chkResetFlatScript.checked) {
			s = localStorage.getItem("flatScript.autoFlatten");
			if(s) {
				chkAutoFlatten.checked = JSON.parse(s);
				chkAutoFlatten.dispatchEvent(new Event("click"));
			}
			s = localStorage.getItem("flatScript.overflow");
			if(s) {
				chkOverflow2.checked = JSON.parse(s);
				//chkOverflow2.dispatchEvent(new Event("input"));
				if(JSON.parse(s))
					ctlFlatScript.classList.add("expanded");
				else
					ctlFlatScript.classList.remove("expanded");
			}
			s = localStorage.getItem("flatScript.lineWrapping");
			if(s) {
				chkLineWrap2.checked = JSON.parse(s);
				//chkLineWrap2.dispatchEvent(new Event("input"));
				if(JSON.parse(s))
					ctlFlatScript.classList.add("lineWrapping");
				else
					ctlFlatScript.classList.remove("lineWrapping");
			}
			s = localStorage.getItem("flatScript.content");
			if(s) {
				ctlFlatScript.innerText = s;
				ctlFlatScript.dispatchEvent(new Event("input"));
			}
		}

		//Overall play controls
		if(!chkResetClipParams.checked) {
			s = localStorage.getItem("clipParams.freqScale");
			if(s) {
				txtPlayFreqScale.value = s;
				txtPlayFreqScale.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("clipParams.volScale");
			if(s) {
				txtPlayVolScale.value = s;
				txtPlayVolScale.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("clipParams.timeScale");
			if(s) {
				txtPlayTimeScale.value = s;
				txtPlayTimeScale.dispatchEvent(new Event("input"));
			}
			s = localStorage.getItem("clipParams.timeDelta");
			if(s) {
				txtPlayTimeDelta.value = s;
				txtPlayTimeDelta.dispatchEvent(new Event("input"));
			}
		}

		//Player
		if(!chkResetPlayer.checked) {
			s = localStorage.getItem("player.autoReload");
			if(s) {
				chkAutoReload.checked = JSON.parse(s);
				chkAutoReload.dispatchEvent(new Event("click"));
			}
		}

		//Audio export
		/* if(!chkResetAudioExport.checked) {
			s = localStorage.getItem("audioExport.");
		} */
	} finally {
		adjustingPreferences = false;
	}
}
function savePreferences() {
	//Page appearance
	localStorage.setItem("pageAppearance.textSize", JSON.stringify(textSize)); //getComputedStyle(document.documentElement).getPropertyValue("--page-scale")?
	localStorage.setItem("pageAppearance.theme", cboPageTheme.value);
	localStorage.setItem("pageAppearance.hue", getComputedStyle(document.documentElement).getPropertyValue("--hue-accent").toString());
	//Generator parameters
	localStorage.setItem("genParams.baseFreq", txtBaseFreq.value); //JSON.stringify(rootFreq)?
	localStorage.setItem("genParams.timeScale", txtTimeScale.value);
	localStorage.setItem("genParams.patternCount", txtPatternCount.value);
	localStorage.setItem("genParams.primeCount", txtPrimeCount.value); //JSON.stringify(primeCount)?
	localStorage.setItem("genParams.expVariance", txtExpVariance.value); //JSON.stringify(expVariance)?
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
	localStorage.setItem("structuredMusic.lineWrapping", JSON.stringify(ctlStructuredScript.classList.contains("lineWrapping")));
	localStorage.setItem("structuredMusic.content", ctlStructuredScript.innerText);
	//Flattened note list
	localStorage.setItem("flatScript.autoFlatten", JSON.stringify(chkAutoFlatten.checked));
	localStorage.setItem("flatScript.overflow", JSON.stringify(ctlFlatScript.classList.contains("expanded")));
	localStorage.setItem("flatScript.lineWrapping", JSON.stringify(ctlFlatScript.classList.contains("lineWrapping")));
	localStorage.setItem("flatScript.content", ctlFlatScript.innerText);
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
}
function resetAllPreferences() {
	localStorage.clear();
	loadPreferences(); //?
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
	if(!window.txtPrimeCount) return false;
	primeCount = NaNToDefault(parseNumber(txtPrimeCount.value), 2);
	if(primeCount < 2) primeCount = 2;
	if(window.outPrimeList) outPrimeList.innerText = "(" + primes.slice(0, primeCount).join(",") + ")";
}

const defaultRootFreq = 440;
var rootFreq = defaultRootFreq, playFreqScale = 1, playVolScale = 1;
function baseFreqChanged() {
	if(!window.txtBaseFreq) return false;
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
	if(!window.txtPlayFreqScale) return false;
	//if(txtPlayFreqScale.valueAsNumber <= 0) txtPlayFreqScale.stepUp();
	playFreqScale = NaNToDefault(parseNumber(txtPlayFreqScale.value), defaultBlockNode.freqRatio);
	if(playerClip) playerClip.playFreqScale = playFreqScale;
}
function playVolScaleChanged() {
	if(!window.txtPlayVolScale) return false;
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
		localStorage.setItem(prefKey, event.target.value);
		return;
	}
	if(event.target.tagName.toUpperCase() === "INPUT") {
		if(event.target.type.toUpperCase() === "CHECKBOX")
			localStorage.setItem(prefKey, JSON.stringify(event.target.checked));
		else
			localStorage.setItem(prefKey, event.target.value);
		return;
	}
	if(event.target.contentEditable.toUpperCase() == "TRUE" || event.target.classList.contains("codeEditor")) {
		localStorage.setItem(prefKey, event.target.innerText);
		return;
	}
	console.warn("Could not save a preference: exceptional control type.");
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
		if(chkResetPageAppearance?.checked) {
			localStorage.removeItem("pageAppearance.textSize");
			localStorage.removeItem("pageAppearance.theme");
			localStorage.removeItem("pageAppearance.hue");

			textSize = 1;
			document.documentElement.style.setProperty("--page-scale", textSize);
			cboPageTheme.value = "Automatic";
			cboPageTheme.dispatchEvent(new Event("input"));
			document.documentElement.style.setProperty("--hue-accent", 120);
		}
		if(chkResetGenParams?.checked) {
			localStorage.removeItem("genParams.baseFreq");
			localStorage.removeItem("genParams.timeScale");
			localStorage.removeItem("genParams.patternCount");
			localStorage.removeItem("genParams.primeCount");
			localStorage.removeItem("genParams.expVariance");

			txtBaseFreq.value = "440";
			txtBaseFreq.dispatchEvent(new Event("input"));
			txtTimeScale.value = "0.5";
			txtTimeScale.dispatchEvent(new Event("input"));
			txtPatternCount.value = "4";
			txtPatternCount.dispatchEvent(new Event("input"));
			txtPrimeCount.value = "3";
			txtPrimeCount.dispatchEvent(new Event("input"));
			txtExpVariance.value = "2";
			txtExpVariance.dispatchEvent(new Event("input"));
		}
		if(chkResetRhythmParams?.checked) {
			localStorage.removeItem("rhythmParams.rhythmScale");
			localStorage.removeItem("rhythmParams.rhythmFactors");

			txtRhythmScale.value = "8";
			txtRhythmScale.dispatchEvent(new Event("input"));
			txtRhythmFactors.value = "2*2*2";
			txtRhythmFactors.dispatchEvent(new Event("input"));
		}
		if(chkResetAddGenParams?.checked) {
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
		if(chkResetStructuredMusic?.checked) {
			localStorage.removeItem("structuredMusic.overflow");
			localStorage.removeItem("structuredMusic.lineWrapping");
			localStorage.removeItem("structuredMusic.content");

			ctlStructuredScript.classList.remove("expanded");
			ctlStructuredScript.classList.remove("lineWrapping");
			chkOverflow1.checked = false;
			chkLineWrap1.checked = false;
			ctlStructuredScript.innerText = defStructuredCode;
			//ctlStructuredScript.dispatchEvent(new Event("input"));
		}
		if(chkResetFlatScript?.checked) {
			localStorage.removeItem("flatScript.autoFlatten");
			localStorage.removeItem("flatScript.overflow");
			localStorage.removeItem("flatScript.lineWrapping");
			localStorage.removeItem("flatScript.content");

			chkAutoFlatten.checked = true;
			//chkAutoFlatten.dispatchEvent(new Event("click"));
			ctlFlatScript.classList.remove("expanded");
			ctlFlatScript.classList.remove("lineWrapping");
			chkOverflow2.checked = false;
			chkLineWrap2.checked = false;
			ctlFlatScript.innerText = defFlattenedCode;
			ctlFlatScript.dispatchEvent(new Event("input"));
		}
		if(chkResetClipParams?.checked) {
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
		if(chkResetPlayer?.checked) {
			localStorage.removeItem("player.autoReload");

			chkAutoReload.checked = false;
			chkAutoReload.dispatchEvent(new Event("click"));
		}
		if(chkResetReset?.checked) {
			localStorage.removeItem("reset.pageAppearance");
			localStorage.removeItem("reset.genParams");
			localStorage.removeItem("reset.rhythmParams");
			localStorage.removeItem("reset.addGenParams");
			localStorage.removeItem("reset.structuredMusic");
			localStorage.removeItem("reset.flatScript");
			localStorage.removeItem("reset.clipParams");
			localStorage.removeItem("reset.player");
			localStorage.removeItem("reset.reset");
			
			chkResetPageAppearance.checked = false;
			chkResetGenParams.checked = false;
			chkResetRhythmParams.checked = false;
			chkResetAddGenParams.checked = false;
			chkResetStructuredMusic.checked = false;
			chkResetFlatScript.checked = false;
			chkResetClipParams.checked = false;
			chkResetPlayer.checked = false;
			chkResetReset.checked = false;
			//.dispatchEvent(new Event("input"));
		}
	} finally {
		adjustingPreferences = false;
	}
}
