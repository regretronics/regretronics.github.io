"use strict";

//to do: code editors:
//to do: 	?line numbers in left side in code editors
//to do: 	?caret position (row, column, char index) status label
//to do: 	?breadcrumb/cascade navigation
//to do: 	?calculate block (inherited) properties for caret context

function codeBoxContentGet(elem) {
	if(!elem) {
		console.info("codeBoxContentGet(): parameter elem is empty. Returning.");
		return false;
	}
	if(["INPUT", "TEXTAREA"].includes(elem.tagName.toUpperCase()))
		return elem.value;
	else
		return elem.textContent; //question: warn/error when it's not contenteditable?
}
//note: this function doesn't try to trigger control events
function codeBoxContentSet(elem, text) {
	if(!elem) {
		console.info("codeBoxContentSet(): parameter elem is empty. Returning.");
		return false;
	}
	if(["INPUT", "TEXTAREA"].includes(elem.tagName.toUpperCase()))
		elem.value = text;
	else
		elem.textContent = text; //question: warn/error when it's not contenteditable?
	return true;
}

function controlGetValue(elem) { //question: exception on failure? (currently no)
	if(!elem) {
		console.info("controlGetValue(): parameter elem is empty. Returning.");
		return undefined;
	}

	if(["SELECT", "TEXTAREA"].includes(elem.tagName.toUpperCase()))
		return elem.value;
	if(elem.tagName.toUpperCase() === "INPUT")
		if(elem.type.toLowerCase() === "checkbox")
			return elem.checked;
		else
			/* if(elem.type.toLowerCase() === "number")
				return elem.valueAsNumber;
			else */
			return elem.value;
	if(elem.contentEditable.toLowerCase() != "false")
		return codeBoxContentGet(elem);

	console.warn(`controlGetValue(): failed to obtain value for #${elem.id}. Exceptional control type.`);
	return undefined;
}
function controlGetDefault(elem) { //question: exception on failure? (currently no)
	if(!elem) {
		console.info("controlGetDefault(): parameter elem is empty. Returning.");
		return undefined;
	}

	if(elem.tagName.toUpperCase() === "SELECT") {
		const opt = document.querySelector(`#${elem.id} option[selected]`);
		if(opt) return opt.value;
	}
	if(elem.tagName.toUpperCase() === "INPUT" && elem.type.toLowerCase() === "checkbox")
		return elem.defaultChecked;
	if(["INPUT", "TEXTAREA"].includes(elem.tagName.toUpperCase()))
		return elem.defaultValue;

	//console.warn(`controlGetDefault(): failed to obtain default value for #${elem.id}. Exceptional control type.`);
	return undefined; //fail silently
}
//note: this function doesn't try to trigger control events
function controlSetValue(elem, value) { //question: exception on failure? (currently no)
	if(!elem) {
		console.info("controlSetValue(): parameter elem is empty. Returning.");
		return false;
	}

	if(["SELECT", "TEXTAREA"].includes(elem.tagName.toUpperCase())) {
		elem.value = value;
		return true;
	}
	if(elem.tagName.toUpperCase() === "INPUT") {
		if(elem.type.toLowerCase() === "checkbox")
			elem.checked = value;
		else
			elem.value = value;
		return true;
	}
	if(elem.contentEditable.toLowerCase() != "false") {
		return codeBoxContentSet(elem, value);
	}

	console.warn(`controlSetValue(): failed to change value for #${elem.id}. Exceptional control type.`);
	return false;
}
//note: this function doesn't try to trigger control events
function controlSetDefault(elem, value) { //question: exception on failure? (currently no)
	if(!elem) {
		console.info("controlSetDefault(): parameter elem is empty. Returning.");
		return false;
	}

	if(elem.tagName.toUpperCase() === "SELECT") {
		for(const option of elem.options)
			option.defaultSelected = option.value == value;
		return true;
	}
	if(elem.tagName.toUpperCase() === "INPUT" && elem.type.toLowerCase() === "checkbox") {
		elem.defaultChecked = value;
		return true;
	}
	if(["INPUT", "TEXTAREA"].includes(elem.tagName.toUpperCase())) {
		elem.defaultValue = value;
		return true;
	}
	/* if(elem.contentEditable.toLowerCase() != "false") {
		elem.ariaPlaceholder = value;
		return true;
	} */

	//console.warn(`controlSetDefault(): failed to change default value for #${elem.id}. Exceptional control type.`);
	return false; //fail silently
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
	txtExpRangeLower.addEventListener("input", txtExpRangeLowerChanged);
	txtExpRangeUpper.addEventListener("input", txtExpRangeUpperChanged);
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
	ctlFlatScript.addEventListener("input", codeBoxResetValidity); //question: also for ctlStructuredScript? (currently no)

	txtPlayFreqScale.addEventListener("input", playFreqScaleChanged);
	txtPlayVolScale.addEventListener("input", playVolScaleChanged);

	btnPlay.addEventListener("click", loadAndPlay);
	btnPause.addEventListener("click", pauseToggle);
	btnStop.addEventListener("click", btnStopClick);

	btnAudioExport.addEventListener("click", audioExport);
	btnAudioExportCancel.addEventListener("click", audioExportCancel);

	btnResetPreferences.addEventListener("click", btnResetPreferencesClick);

	for(const elem of document.querySelectorAll("[data-pref]")) {
		const prefKey = elem.dataset?.pref;
		if(!prefKey || prefKey == "") continue;
		if(preferencesKeysFlat[prefKey] !== "object")
			elem.addEventListener("input", saveInputValue);
	}

	//editable code-box'es: having the contenteditable attribute, but not with false as its value
	for(const elem of document.querySelectorAll(".code-box[contenteditable]:not([contenteditable=false i])")) {
		elem.addEventListener("keydown", editorKeyDown);
		elem.addEventListener("paste", editorPaste);
		//elem.addEventListener("input", editorChanged);
		//elem.addEventListener("keyup", recalcEditorCursorPos);
		//elem.addEventListener("click", recalcEditorCursorPos);
	}
	//globalThis.addEventListener("paste", editorPaste);

	{
		const main1 = document.getElementsByTagName("main")[0]; //limited scope and life-time declaration
		main1.addEventListener("dragover", mainDragOver);
		main1.addEventListener("drop", mainDrop);
	}
}
function addControlSeparators() {
	console.log("addControlSeparators(): function started...");
	//control separators
	//for(const controlCell of document.querySelectorAll('.cell:not(:first-of-type)')) {
	for(const controlCell of document.querySelectorAll(':nth-child(n + 2 of .cell)')) {
		const separator = document.createElement("span");
		separator.classList.add("separator");

		//controlCell.parentElement.insertBefore(separator, controlCell);
		//controlCell.insertBefore(separator, controlCell.firstElementChild);
		//remove unwanted white space that could affect spacing
		const first = controlCell.firstChild;
		if(first.nodeType == Node.TEXT_NODE && first.nodeValue.trim() == "")
			controlCell.removeChild(first);
		controlCell.insertBefore(separator, controlCell.firstChild);
		//controlCell.prepend(separator, "\u{A0}");
	}
	console.log("addControlSeparators(): function ending");
}
//to do: rigorous review of load routine order
function pageLoaded(event) {
	//load HTML element references (renders document.getElementById unnecessary)
	for(const elem of document.querySelectorAll('[id]'))
		globalThis[elem.id] = elem;

	try {
		adjustingPreferences = true;

		globalThis.genPrefsKeysFlat();
		globalThis.ctlDefaultsToPrefs(prefsDefault);
		storageToPrefs(prefs);
		/* let prevResetState = */ applyPrefsReset(prefs, prefsDefault);

		globalThis.prefsToControls(prefs, undefined, null); //null is for touching both controls that were and weren't reset
		globalThis.prefsToControlsSpecial(prefs, undefined, null);
		themeChanged({target: cboPageTheme});
		//globalThis.rhythmFactorsChanged?.();
		//triggerPrefControls(false, prevResetState);
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failed to load preferences. " + (error.message ?? error ?? ""), 3);
		return false;
	} finally {
		adjustingPreferences = false;
	}

	if(globalThis.outAudioT) outAudioT.innerText = toFixedTrunc(0, timeDisplPrecision);
	if(globalThis.outAudioDur) outAudioDur.innerText = toFixedTrunc(0, timeDisplPrecision);
	if(globalThis.txtPrimeCount) txtPrimeCount.max = primes.length.toString();
	//to do: normalize() for ctlStructuredScript and ctlFlatScript?

	initialCalculations();

	Promise.resolve().then(addControlSeparators)/* ?.catch?.(reason => {
			globalThis.reportError(reason);
		}) */;

	Promise.resolve().then(addIntervalSamples)/* ?.catch?.(reason => {
			globalThis.reportError(reason);
		}) */;

	console.log("pageLoaded(): function ending");
}
function pageReady(event) {
	Promise.resolve().then(value => {
			console.log("pageReady() promise: function started...");
			//prefsToCtlDefaults(prefsDefault);
			loadEventHandlers();

			//updateThemeColor(getComputedStyle(document.documentElement).getPropertyValue("--hue-accent0"));
			setAutoFlatten(prefs.flatScript.autoFlatten);
			adjustingPreferences = true;
			try {
				for(const elem of document.querySelectorAll("input.exp"))
					//expSpinnerChanged({target: elem});
					updateExpSpinner(elem);
				//triggerPrefControls();
			} finally {
				adjustingPreferences = false;
			}

			globalThis.updatePrimeList?.();
			//globalThis.rhythmFactorsChanged?.();
			globalThis.updateRhythmAccum?.();
			globalThis.initSpinControls?.(); //custom-spin.js

			addToolTipHandler("body>main", event => updateCtlToolTip(event, outToolTip));
			addToolTipHandler("#tblFractionIntervals", event => updateCtlToolTip(event, outToolTipIntervals));
			for(let label of document.querySelectorAll('label[for]'))
				//label.title = document.getElementById(label.htmlFor).title ?? "";
				label.title = label.control?.title ?? "";
			console.log("pageReady() promise: function ending");
		})/* ?.catch?.(reason => {
			globalThis.reportError(reason);
		}) */;

	//just eye candy
	//if(globalThis.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
		//globalThis.setInterval(hueAnimation, 150);
		/*globalThis.setInterval(() => { //test: spectrum bars (bad performance as of Ffx 114 and Chrome 116 for Windows)
				const barsArr = "▁▂▃▄▅▆▇█";
				let barsStr = "";
				for(let rept = 0; rept < 4; rept++) barsStr += barsArr[Math.floor(Math.random() * bars.length)];
				document.title = barsStr + " JSON music";
			}, 200);*/
	//}
}
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else {
	console.info("DOMContentLoaded has already fired unhooked.");
	pageLoaded();
}
globalThis.addEventListener("load", pageReady);
//globalThis.addEventListener("load", async event => pageReady(event););
//globalThis.addEventListener("load", event => Promise.resolve().then(value => {pageReady(event);}););
//globalThis.addEventListener("load", event => Promise.resolve().then(pageReady););

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
	if(!adjustingPreferences && elem.dataset["pref"])
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
	if(!adjustingPreferences && elem.dataset["pref"])
		localStorage.setItem(elem.dataset["pref"], JSON.stringify(control.classList.contains("line-wrap")));
}

function updateExpSpinner(elem) {
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
	const stepRatio = NaNToDefault(parseFloat(elem.dataset?.stepRatio), 0.25);
	const step = stepRatio * 2 ** magnitude;
	const dynMin = val - 2 * Math.sign(val) * step, min = parseFloat(elem.dataset.min);
	if(min === undefined || isNaN(min)) {
		elem.step = step;
		//if(elem == txtBaseFreq) elem.min = val - 2 * step;
		elem.min = dynMin;
	} else {
		elem.step = Math.max(min, step);
		elem.min = Math.max(min, dynMin);
	}
}
//to do: force-allow arbitrary strings for "parseNumber" inputs by using type="text".
function expSpinnerChanged(event) {
	//console.log(event);
	const elem = event.target;
	if(!elem) {
		console.info("expSpinnerChanged(): parameter event.target is empty. Returning.");
		return false;
	}
	updateExpSpinner(event.target);

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

function btnRhythmFactorsGenClick(event) {
	try {
		prefs.rhythmParams.rhythmFactors = makeRhythmFactors(parseNumber(txtRhythmScale.value), prefs.primeFactors.primeCount);
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Rhythm structure generator failed. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	if(!adjustingPreferences) localStorage.setItem("rhythmParams.rhythmFactors", JSON.stringify(prefs.rhythmParams.rhythmFactors));
	if(globalThis.txtRhythmFactors) {
		txtRhythmFactors.value = prefs.rhythmParams.rhythmFactors.join("*");
		//txtRhythmFactors.dispatchEvent(new Event("input"));
	}
	updateRhythmAccum();
	return true;
}
function btnChordGenClick(event) {
	try {
		prefs.basicParams.freqRangeMin = parseNumber(globalThis.txtFreqRangeMin?.value);
		prefs.basicParams.freqRangeMax = parseNumber(globalThis.txtFreqRangeMax?.value);
		const rootStruct = makeChords(parseInt(txtPatternCount.value), parseInt(txtVoiceCount.value), parseNumber(txtTimeScale.value), prefs.primeFactors.primeCount, prefs.primeFactors.expRanges);
		if(rootStruct === false) throw(new Error());

		setStructuredText(toJSONCodeAdjusted(rootStruct));
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in chord generator. " + (error.message ?? error ?? ""), 3);
	}
}
function btnRhythmGenClick(event) {
	try {
		prefs.basicParams.freqRangeMin = parseNumber(globalThis.txtFreqRangeMin?.value);
		prefs.basicParams.freqRangeMax = parseNumber(globalThis.txtFreqRangeMax?.value);
		const rootStruct = makeRhythm(parseInt(txtReptCount.value), chkPercussivePattern.checked, parseNumber(txtTimeScale.value));
		if(rootStruct === false) throw(new Error());

		setStructuredText(toJSONCodeAdjusted(rootStruct));
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in rhythm generator. " + (error.message ?? error ?? ""), 3);
	}
}
function btnMelodyGenClick(event) {
	try {
		prefs.basicParams.freqRangeMin = parseNumber(globalThis.txtFreqRangeMin?.value);
		prefs.basicParams.freqRangeMax = parseNumber(globalThis.txtFreqRangeMax?.value);
		const rootStruct = makeMelody(parseInt(txtPatternCount.value), parseNumber(txtReptPeriod.value), parseInt(txtReptCount.value), parseNumber(txtTimeScale.value), chkPercussivePattern.checked, prefs.primeFactors.primeCount, prefs.primeFactors.expRanges);
		if(rootStruct === false) throw(new Error());

		setStructuredText(toJSONCodeAdjusted(rootStruct));
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
		const rng = globalThis.getSelection?.()?.getRangeAt?.(0); //disregarding multiple selection, which only Firefox supports (to do?)
		if(!rng) {
			console.info("deletePrevTab(): member globalThis.getSelection().getRangeAt(0) is empty. Returning.");
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

	let paste = (event.clipboardData || globalThis.clipboardData).getData("text");
	const selection = globalThis.getSelection?.();
	if(!selection || !selection.rangeCount) {
		console.info("editorPaste(): member globalThis.getSelection().rangeCount is empty. Returning.");
		return false;
	}
	selection.deleteFromDocument();
	selection.getRangeAt(0).insertNode(document.createTextNode(paste));
	selection.collapseToEnd();
}
function codeBoxResetValidity(event) {
	if(!event || !event.target || !event.target.classList) {
		console.info("codeBoxResetValidity(): parameter event.target.classList is empty. Returning.");
		return false;
	}
	event.target.classList.remove("invalid");
	if(!adjustingPreferences) event.target.classList.remove("outdated");
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

	const rng = globalThis.getSelection?.()?.getRangeAt?.(0); //disregarding multiple selection, which only Firefox supports (to do?)
	if(!rng) {
		console.info("recalcEditorCursorPos(): member globalThis.getSelection().getRangeAt(0) is empty. Returning.");
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
function setToolTip(toolTipCtl, text, warnLevel) {
	if(!toolTipCtl) toolTipCtl = globalThis.outToolTip;
	if(!toolTipCtl) {
		console.info("toolTipCtl(): toolTipCtl parameter and globalThis.outToolTip are both empty. Returning.");
		return false;
	}

	/* if(!text) {
		console.info("toolTipCtl(): parameter text is empty. Returning.");
		return false;
	}
	if(typeof(text) !== "string") text = text.toString(); */
	if(!text) text = "";
	if(typeof(text) !== "string") text = text.toString();
	text = text.trim();

	toolTipCtl.innerText = text;
	//toolTipCtl.innerHTML = text;
	toolTipCtl.classList.toggle("active", text !== "");

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
//to do: review this code
//to do: separate AudioContext?
function playIntervalHandler(event) {
	if(!event?.target?.dataset) {
		console.info("playIntervalHandler(): parameter event.target.dataset is empty. Returning.");
		return false;
	}
	try {
		const fraction = parseNumber(event.target.dataset["fraction"]);
		if(isNaN(fraction) || fraction == 0 || Math.abs(fraction) == Infinity) throw(new Error(`Unrecognized interval: ${fraction}.`));

		if(prefs.genParams.baseFreq == 0) throw(new Error("Invalid base frequency setting."));
		if(prefs.clipParams.freqScale == 0) throw(new Error("Invalid playback frequency scale setting."));
		const playTimeScale = NaNToDefault(parseNumber(globalThis.txtPlayTimeScale?.value), prefsDefault.clipParams.timeScale);
		//to do: allow reverse playback? (currently no)
		if(playTimeScale <= 0) throw(new Error("Invalid playback time scale setting."));
		//const playTimeDelta = NaNToDefault(parseNumber(globalThis.txtPlayTimeDelta?.value), prefsDefault.clipParams.timeDelta); //question: applicable here?
		const playTimeDelta = 0; //probably not, I think.

		const noteTInterval = 0.25, noteDuration = 3;
		const clip = new SoundClip(null, playTimeScale * (noteDuration + noteTInterval), playTimeScale, playTimeDelta, prefs.clipParams.volScale, prefs.clipParams.freqScale);
		clip.playButton = event.target;
		clip.onClipEnd = clipEndInterval;
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
				freq: prefs.genParams.baseFreq, vol: 0.5,
				portamento: 0, vibratoFreq: 0, vibratoDepth: 0, vibratoAttack: 0
			});
		renderNote(clip, {
				noteStart: noteTInterval, noteStop: noteTInterval + noteDuration,
				freq: fraction * prefs.genParams.baseFreq, vol: 0.5,
				portamento: 0, vibratoFreq: 0, vibratoDepth: 0, vibratoAttack: 0
			});
		if(clip.audioCtx.state === 'suspended')
			clip.audioCtx.resume()?.then?.(nil => {
					//playerClip = clip
					clip.playButton.classList?.add?.("playing");
				})?.catch?.(reason => {
					setToolTip(outToolTipIntervals, "Could not resume playback. " + (reason.message ?? reason ?? ""), 3);
					//globalThis.reportError(reason);
					console.error(reason);
				});
		clip.open = true;
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Failure in interval player. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}
function clipEndInterval(suspend) {
	const clip = this /* ?? intervalClip */;
	if(!clip) {
		console.info("clipEndInterval(): parameter 'this' is empty. Returning.");
		//console.info("clipEndInterval(): parameters this and intervalClip are empty. Returning.");
		return false;
	}

	return clip.clipEndDefault(true)?.then?.(nil => {
			if(clip.playButton)
				clip.playButton.classList?.remove?.("playing");
			//clip.audioCtx.close(); //to do: use this in place of suspend()?
			//if(intervalClip === clip) intervalClip = null;
		}/* , reason => {
			globalThis.reportError(reason);
		} */);
	//return true;
}
