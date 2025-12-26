"use strict";

var modRules;
const categories = {
	all: [],
	standard: [],
	bottomLevel: ["analytical", "analytical.fractionary", "analytical.bit", "analytical.realnonneg", "analytical.real", "analytical.intnonneg", "analytical.int", "analytical.list", "string"],
};

function btnGenerateContentClick(event) {
	const isCatRandom = selRootCategory.selectedIndex === 0;
	const rootCat = (isCatRandom ? randomFromList(categories[selRootCategoryGroup.value]) : selRootCategory.value);

	const content = makeNewContent(rootCat.split("/"));
	//outSummary.textContent = JSON.stringify(content, null, "\t");
	outSummary.textContent = JSON.stringify(content, jsonReplacer, "\t");
	localStorage.setItem("rootCategoryGroup", selRootCategoryGroup.value);
	localStorage.setItem("rootCategory", selRootCategory.value);
}
function editorKeyDown(event) {
	//if(event.key == "Tab") {
	if(event.key == "Tab" && !event.shiftKey) {
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
function editorChanged(event) {
	if(!event) return false;
	event.target?.normalize?.();
}
function editorInput(event) {
	if(!event || !event.target || !event.target.classList) return false;
	event.target.classList.remove?.("invalid");
	event.target.classList.add?.("changed");
}
async function txtRulesSourceBlur(event) {
	if(!event || !event.target) return false;
	try {
		modRules = null;
		await loadRulesModule(txtRulesSource.textContent);
		if(!checkRulesModule(modRules)) return;
		loadCategoryGroups();
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
		loadCategoryGroups();
	}
}

function persistRules(event) {
	localStorage.setItem("modRules.source", txtRulesSource.textContent);
	txtRulesSource.classList?.remove?.("changed");
}
async function loadRulesModule(scriptText) {
	const blob = new Blob([scriptText], {type: "text/javascript"});
	const url = URL.createObjectURL(blob);
	modRules = await import(url);
	URL.revokeObjectURL(url);
}
function checkRulesModule(modRules) {
	if(!modRules) {
		outSourceStatus.innerText = "Couldn't load module.";
		txtRulesSource.classList?.add?.("invalid");
		return false;
	}
	const requiredMembers = ["categoryValues", "fieldValues", "categoryFieldsReq", /* "categoryFieldsOpt", */ "fieldCategories"]; //question: include taxonomy?
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

		outSourceStatus.innerText = "";
		txtRulesSource.classList?.remove?.("invalid");
		return true;
	} catch(error) {
		outSourceStatus.innerText = error.message;
		txtRulesSource.classList?.add?.("invalid");
		return false;
	}
}
async function fetchDefaultRules() {
	if(!window.defaultRules || origin === "null") return false;
	try {
		const url = defaultRules.href;
		const response = await fetch(url);
		//const response = await fetch(url, {mode: "same-origin"});
		if(response.ok) {
			txtRulesSource.textContent = await response.text();
			await loadRulesModule(txtRulesSource.textContent);
			outSourceStatus.innerText = "";
			txtRulesSource.classList?.remove?.("invalid");
		} else {
			console.log(response);
			//throw new Error(`Response status: ${response.status}`);
		}
		return response.ok;
	} catch(error) {
		outSourceStatus.innerText = error.message;
		txtRulesSource.classList?.add?.("invalid");
		return false;
	}
}
async function readDefaultRules() {
	if(await fetchDefaultRules()) return true;
	if(!window.defaultRulesBody) return false;
	try {
		//remove excess indentation
		let rulesBody = defaultRulesBody.text.trimEnd().split("\n");
		if(rulesBody[0].trim().length < 1) rulesBody.shift(); //initial blank line?
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

function loadCategoryGroups() {
	if(!modRules) return false;
	categories.standard = [];
	const catValues = modRules.fieldValues?.category;
	for(const value of catValues) {
		if(value.startsWith("taxonomy:")) {
			const taxRoot = value.slice(value.indexOf(":") + 1);
			categories.standard.push(...modRules.taxonomy[taxRoot]);
		} else
			categories.standard.push(value);
	}
	const setOfKeys = (obj) => {
		const arr = Object.keys(obj).map((elem) => {
			const lastSeparatorIdx = elem.lastIndexOf("/");
			if(lastSeparatorIdx >= 0)
				return elem.slice(lastSeparatorIdx + 1);
			else
				return elem;
		});
		return new Set(arr);
	};
	const allCategories = [
		setOfKeys(modRules.categoryValues),
		setOfKeys(modRules.categoryFieldsReq),
	];
	//to do: consider including categories from the right-hand side of fieldCategories.
	categories.all = Array.from(allCategories[0].union(allCategories[1]));
	//categories.all = [];
	//categories.bottomLevel = modRules.taxonomy?.analytical;
	loadCategories();
}
function loadCategories() {
	const group = categories[selRootCategoryGroup.value];
	if(!group) {
		selRootCategory.options.length = 1;
		return;
	}
	selRootCategory.options.length = 1 + group.length;
	group.forEach((element, index) => {
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
	for(const elem of document.getElementsByClassName("code-box")) {
		elem.addEventListener("keydown", editorKeyDown);
		//elem.addEventListener("paste", editorPaste);
		//elem.addEventListener("input", editorChanged);
	}
	for(const elem of document.getElementsByClassName("code-editor")) {
		elem.addEventListener("input", editorInput);
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

		const catGroup = localStorage.getItem("rootCategoryGroup");
		if(catGroup) selRootCategoryGroup.value = catGroup;
		loadCategoryGroups();
		selRootCategoryGroup.addEventListener("input", loadCategories);

		const cat = localStorage.getItem("rootCategory");
		if(cat) selRootCategory.value = cat;
		selRootCategory.addEventListener("input", btnGenerateContentClick);
		btnGenerateContentClick(null);
	} catch(error) {
		outSummary.textContent = "Couldn't use rules module.\n" + error.message;
	}
}

if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
