"use strict";

var modRules;

function btnGenerateContentClick(event) {
	const selectedCat = selRootCategory.value;
	let isCatRandom = selectedCat == "random";
	if(!isCatRandom && !modRules.fieldInstances.category.includes(selectedCat))
		isCatRandom = true;
	const rootCat = (isCatRandom ? randomFromList(modRules.fieldInstances.category) : selectedCat);

	const content = makeNewContent(rootCat);
	//outSummary.textContent = JSON.stringify(content, null, "\t");
	outSummary.textContent = JSON.stringify(content, jsonReplacer, "\t");
	localStorage.setItem("rootCategory", selRootCategory.value);
}
function editorKeyDown(event) {
	if(event.key == "Tab") {
		event.stopPropagation();
		event.preventDefault();

		//tried to dispatch input or beforeinput events. didn't work.
		//event.target.dispatchEvent(new InputEvent("beforeinput", {data: "\t", inputType: "insertText"}));

		event.target.focus(); //unnecessary?
		/* if(event.shiftKey)
			deletePrevTab();
		else */
			document.execCommand("insertText", false, "\t");
	}
	//to do: home key goes past initial indentation?
}
function editorInput(event) {
	if(!event || !event.target || !event.target.classList) return false;
	event.target.classList.remove?.("invalid");
	event.target.classList.add?.("changed");
}
function editorChanged(event) {
	if(!event) return false;
	event.target?.normalize?.();
}
async function txtRulesSourceBlur(event) {
	if(!event || !event.target) return false;
	try {
		modRules = null;
		await loadRulesModule(txtRulesSource.textContent);
		if(!checkRulesModule(modRules)) return;
		loadCategoryList();
		//outSourceStatus.innerText = "";
	} catch(error) {
		//report error to UI
		outSourceStatus.innerText = error.message;
		event.target?.classList?.add?.("invalid");
	}
}
async function btnRulesResetClick(event) {
	if(readDefaultRules()) {
		localStorage.removeItem("modRules.source");
		localStorage.removeItem("rootCategory");
		txtRulesSource.classList?.remove?.("invalid");
		loadCategoryList();
	}
}

function persistRules(event) {
	localStorage.setItem("modRules.source", txtRulesSource.textContent);
	txtRulesSource.classList?.remove?.("changed");
}
async function loadRulesModule(scriptText) {
	const blob = new Blob([scriptText], {type: "text/javascript"});
	//const script = document.createElement("script");
	const url = URL.createObjectURL(blob);
	//script.onload = script.onerror = () => URL.revokeObjectURL(url);
	//script.src = url;
	//document.body.appendChild(script);
	//modRules = await import(defaultRules.href);
	//modRules = await import("ontolSource.js");
	modRules = await import(url);
	URL.revokeObjectURL(url);
}
function checkRulesModule(modRules) {
	if(!modRules) {
		outSourceStatus.innerText = "Couldn't load module.";
		txtRulesSource.classList?.add?.("invalid");
		return false;
	}
	const requiredMembers = ["categoryValues", "fieldInstances", "categoryFieldsReq", /* "categoryFieldsOpt", */ "fieldCategories"];
	for(const member of requiredMembers) {
		if(!modRules[member]) {
			outSourceStatus.innerHTML = `Member <code>${member}</code> is missing.`;
			txtRulesSource.classList?.add?.("invalid");
			return false;
		}
	}
	outSourceStatus.innerText = "";
	txtRulesSource.classList?.remove?.("invalid");
	return true;
}
async function readRulesFromStorage() {
	if(localStorage.length < 1) return false;
	try {
		const src = localStorage.getItem("modRules.source");
		if(!src || src.length < 1) return false;
		txtRulesSource.textContent = src;
		await loadRulesModule(txtRulesSource.textContent);
		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}
async function fetchDefaultRules() {
	if(!window.defaultRules || origin === "null") return false;
	try {
		//const url = (window.defaultRules ? defaultRules.href : "ontolSource.js");
		const url = defaultRules.href;
		const response = await fetch(url);
		//const response = await fetch(url, {mode: "same-origin"});
		if(response.ok) {
			txtRulesSource.textContent = await response.text();
			await loadRulesModule(txtRulesSource.textContent);
		} else {
			console.log(response);
			//throw new Error(`Response status: ${response.status}`);
		}
		return response.ok;
	} catch(error) {
		console.error(error);
		return false;
	}
}
async function readDefaultRules() {
	if(await fetchDefaultRules()) return true;
	if(!window.defaultRulesBody) return false;
	try {
		//remove excess indentation
		let rulesBody = defaultRulesBody.text.trimEnd().split("\n");
		if(rulesBody[0].length < 1) rulesBody.shift();
		//let rulesBody = defaultRulesBody.text.trim();
		//const indent = rulesBody.at(-1) + "\t";

		const regex = new RegExp(/^[ \t]*/, "");
		const indent = rulesBody[0].match(regex)[0], indentSize = indent.length;
		rulesBody = rulesBody.map(line => (
			line.startsWith(indent) ? 
				line.slice(indentSize) :
				line.replace(regex, "")
		));
		txtRulesSource.textContent = rulesBody.join("\n");
		await loadRulesModule(txtRulesSource.textContent);
		return checkRulesModule(modRules);
		//outSourceStatus.innerText = "";
	} catch(error) {
		console.error(error);
		outSourceStatus.innerText = error.message;
		return false;
	}
}
function loadCategoryList() {
	if(!modRules || !modRules.fieldInstances?.category) {
		selRootCategory.options.length = 1;
		return;
	}
	selRootCategory.options.length = 1 + modRules.fieldInstances.category.length;
	modRules.fieldInstances.category.forEach((element, index) => {
		const optItem = selRootCategory.item(1 + index);
		if(!optItem) return;
		optItem.text = element;
	});
}

function pageLoaded(event) {
	//load HTML element references (renders document.getElementById unnecessary)
	for(const s of document.querySelectorAll("[id]"))
		window[s.id] = s;

	//trap UI changes
	btnGenerateContent.addEventListener("click", btnGenerateContentClick);
	for(const elem of document.getElementsByClassName("code-editor")) {
		elem.addEventListener("keydown", editorKeyDown);
		//elem.addEventListener("paste", editorPaste);
		elem.addEventListener("input", editorInput);
		//elem.addEventListener("input", editorChanged);
		//elem.addEventListener("keyup", recalcEditorCursorPos);
		//elem.addEventListener("click", recalcEditorCursorPos);
	}
}
async function pageReady(event) {
	if(!(await readRulesFromStorage()) && !(await readDefaultRules())) {
		txtRulesSource.classList?.add?.("invalid");
		outSummary.textContent = "Couldn't read default rules.";
		return;
	}

	try {
		btnRulesReset.addEventListener("click", btnRulesResetClick);
		if(window.txtRulesSource) {
			txtRulesSource.addEventListener("input", persistRules);
			txtRulesSource.addEventListener("blur", txtRulesSourceBlur);
		}
		if(!checkRulesModule(modRules)) return;
		loadCategoryList();
		const cat = localStorage.getItem("rootCategory");
		if(cat) selRootCategory.value = cat;
		selRootCategory.addEventListener("input", btnGenerateContentClick);

		/* const rootCat = randomFromList(modRules.fieldInstances.category);
		const content = makeNewContent(rootCat);
		//outSummary.textContent = JSON.stringify(content, null, "\t");
		outSummary.textContent = JSON.stringify(content, jsonReplacer, "\t"); */
		btnGenerateContentClick(null);
	} catch(error) {
		outSummary.textContent = "Couldn't use rules module.\n" + error.message;
	}
}
