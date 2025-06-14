"use strict";

function randomFromList(list) {
	if(!list || list.length < 1) return undefined;
	return list[Math.floor(list.length * Math.random())];
}
function makeQuantitative(type) {
	const rnd = Math.random(); //uniform distribution: between 0 and 1 (0 <= rnd < 1, precisely)
	/* if(type.startsWith("analytical.fractionary")) return rnd;
	if(type.startsWith("analytical.bit")) return Math.round(rnd); //also serves as logical value
	if(type.startsWith("analytical.realpositive")) return - Math.log(rnd);
	if(type.startsWith("analytical.real")) return Math.log((1.0 - rnd) / rnd); //inverse sigmoid: real number (symmetrical)
	if(type.startsWith("analytical.intnonneg")) return Math.trunc(- Math.log(rnd));
	if(type.startsWith("analytical.int")) return Math.round(Math.log((1.0 - rnd) / rnd));
	//if(type.startsWith("analytical.")) return ;

	return - Math.log(- Math.log(rnd)); //inverse sigmoid: real number (skewed towards positive numbers) */

	let value;
	switch(true) {
		case type.startsWith("analytical.fractionary"):
			value = rnd;
			break;

		case type.startsWith("analytical.bit"):
			value = Math.round(rnd); //also serves as logical value
			break;

		/* case type.startsWith("analytical.realpositive"):
			value = - Math.log(rnd); //may yield infinity
			break; */

		case type.startsWith("analytical.realnonneg"):
			value = - Math.log(1.0 - rnd);
			break;

		case type.startsWith("analytical.real"):
			value = Math.log((1.0 - rnd) / rnd); //inverse sigmoid: real number (symmetrical)
			break;

		case type.startsWith("analytical.intnonneg"):
			//value = Math.trunc(- Math.log(rnd)); //may yield infinity
			value = Math.trunc(- Math.log(1.0 - rnd));
			break;

		case type.startsWith("analytical.int"):
			value = Math.round(Math.log((1.0 - rnd) / rnd));
			break;

		/* case type.startsWith("analytical.list"):
			//"analytical.list.4"
			//"analytical.list/string"
			//"analytical.list.4/string"
			break; */

		/* case type.startsWith("analytical"):
			break; */

		default:
			value = - Math.log(- Math.log(rnd)); //inverse sigmoid: real number (skewed towards positive numbers)
			break;
	}

	//const magnitude = Math.floor(Math.log10(Math.abs(value))), grain = Math.pow(10.0, magnitude - 3);
	//return grain * Math.round(value / grain);
	//return value.toPrecision(4);
	return value;

	//to do:
	//	vectors or lists
	//	quantitative functions
}
function makeString(length) {
	let lengthN = Number(length);
	if(length === null || isNaN(lengthN)) {
		//(1.0 - Math.random()) avoids 0 (might return 1).
		//const rndPositive = -4 * Math.log(1.0 - Math.random());
		//const rndPositive = - Math.E * Math.log(1.0 - Math.random());
		const rndPositive = -2 * Math.log2(1.0 - Math.random());
		lengthN = 1 + Math.trunc(rndPositive);
	} else {
		if(lengthN < 1) return "";
	}

	const fnLetterCode = () => (
		"a".charCodeAt() + Math.trunc(26 * Math.random())
	);
	const charList = Array.from(Array(lengthN), fnLetterCode);
	//const charList = Array(lengthN).map(fnLetterCode); //map doesn't work with an empty array.
	return String.fromCodePoint(...charList);
}

var modRules;

//generator main routine
//recursive function
function makeNewContent(rootCat, parentContext, repeatDepthLimit) {
	/* let content = { //rejected format
		conceptual: {
			process: "adolescence"
		}
	}; */
	/* let content = {
		"conceptual.process": "adolescence"
	}; */
	/* let content = {
		category: "conceptual",
		category2: "process",
		type: "adolescence",
		roles: {
			father: {
				category: "material",
				category2: "person",
				name: "Paul",
			},
			mother: {
				category: "material",
				category2: "person",
				name: "Mary",
			},
			firstPerson: {
				category: "material",
				category2: "person",
				name: "George",
			},
		},
	}; */

	const content = {category: rootCat};
	if(!rootCat) return content;
	if(!modRules) return;

	if(parentContext == undefined) parentContext = "";
	//for the moment, only take the last part of the parent context.
	//if(parentContext.includes("/")) parentContext = parentContext.split("/").at(-1);
	const lastSeparatorIdx = parentContext.lastIndexOf("/");
	if(lastSeparatorIdx >= 0) parentContext = parentContext.slice(lastSeparatorIdx + 1);

	let cat1, cat2; //to do: use an array, and split instead of indexOf?
	//specific content generators
	//primary (depending only of category/type description)
	if(rootCat.startsWith("analytical"))
		content.value = makeQuantitative(rootCat);
	else {
		const separatorIdx = rootCat.indexOf("/");
		if(separatorIdx >= 0) {
			cat1 = rootCat.substring(0, separatorIdx);
			cat2 = rootCat.slice(separatorIdx + 1);
		}

		//e.g. if rootCat is "roles/agent", and it admits a "value":
		//the value depends first on values for "roles/agent", or else values for just "roles" (less specific).
		//including parent field name makes the selector more specific, which goes first.
		const tryTakeFromList = (selector) => {
			if(content.value) return;
			const list = modRules.categoryValues[selector];
			if(list) content.value = randomFromList(list);
		};
		//if(cat2) tryTakeFromList(cat2);
		if(parentContext.length > 0) {
			tryTakeFromList(parentContext + "/" + rootCat);
			if(cat1) tryTakeFromList(parentContext + "/" + cat1);
		}
		tryTakeFromList(rootCat);
		if(cat1) tryTakeFromList(cat1);

		if(!content.value && rootCat === "string")
			content.value = makeString();
		if(!content.value && cat1 === "string")
			content.value = makeString(cat2);
	}
	//to do:
	//	strings: names/pronounceable words
	//	colors
	//	variable-sized arrays/lists
	//	references
	//	functions

	const defaultRepeatDepthLimit = 2;
	if(repeatDepthLimit == undefined)
		repeatDepthLimit = defaultRepeatDepthLimit;
	else
		if(repeatDepthLimit < 1) return content;

	//composite object (map): field choice and filling
	//required and primary (arbitrary, i.e. most independent) fields
	//let fieldList = modRules.categoryFieldsReq[rootCat] ?? modRules.categoryFieldsReq[cat1];
	//looks under multiple selection criteria. if multiple field lists exist, merge them.
	let fieldList = [];
	const tryIncludeFieldList = (selector) => {
		const list = modRules.categoryFieldsReq[selector];
		if(list) fieldList = fieldList.concat(list);
	};
	//including parent field name makes the selector more specific, which goes first.
	if(parentContext.length > 0) {
		tryIncludeFieldList(parentContext + "/" + rootCat);
		tryIncludeFieldList(parentContext + "/" + cat1);
	}
	tryIncludeFieldList(rootCat);
	tryIncludeFieldList(cat1);

	if(fieldList.length >= 1) {
		//const catIndex = modRules.fieldInstances.category.indexOf(rootCat) /* + 1 */;
		let catIndex = modRules.fieldInstances.category.indexOf(rootCat);
		const catCount = modRules.fieldInstances.category.length;
		if(catIndex + 1 < catCount && repeatDepthLimit < 2) catIndex++;
		for(const field of fieldList) {
			if(content[field]) continue; //avoid duplicates (I could have used a set of fields instead)
			let fieldCat = cat2 
				?? randomFromList(modRules.fieldCategories[rootCat + "/" + field]) 
				?? randomFromList(modRules.fieldCategories[field]);
			let value;
			if(fieldCat) {
				value = randomFromList(modRules.fieldInstances[field + "/" + fieldCat]);
				if(!value)
					value = makeNewContent(fieldCat, parentContext + "/" + field, (fieldCat === rootCat) ? (repeatDepthLimit - 1) : defaultRepeatDepthLimit);
			} else {
				value = randomFromList(modRules.fieldInstances[rootCat + "/" + field]) ?? randomFromList(modRules.fieldInstances[field]);
				if(!value) {
					//if(catIndex > 0 && catIndex <= catCount)
					if(catIndex >= 0)
						fieldCat = modRules.fieldInstances.category[catIndex
						 + Math.floor((catCount - catIndex) * Math.random())];
					else
						fieldCat = modRules.fieldInstances.category.at(-1);
					value = makeNewContent(fieldCat, parentContext + "/" + field, (fieldCat === rootCat) ? (repeatDepthLimit - 1) : defaultRepeatDepthLimit);
				}
			}
			content[field] = value;
		}
	}
	//to do:
	//modRules.categoryFieldsOpt
	//optional and primary (arbitrary) fields
	//required and dependent fields
	//optional and dependent fields

	//the explicit stack approach may become unnecessary, but I'm not sure yet.
	/* const contentStack = {};
	let field = "category";
	content[field] = rootCat;
	do {
		content[field] = modRules.fieldInstances[field][0];
		//deepen
		//iterate
		//return
	} while(); */

	return content;
}
function jsonReplacer(key, value) {
	if(typeof(value) === "number") {
		/* const magnitude = Math.floor(Math.log10(Math.abs(value)));
		const grain = Math.pow(10.0, magnitude - 3);
		return grain * Math.round(value / grain); */
		return value.toPrecision(4);
	}
	return value;
}

function btnGenerateContentClick(event) {
	const selectedCat = selRootCategory.value;
	let isCatRandom = selectedCat == "random";
	if(!isCatRandom && !modRules.fieldInstances.category.includes(selectedCat))
		isCatRandom = true;
	const rootCat = (isCatRandom ? randomFromList(modRules.fieldInstances.category) : selectedCat);

	const content = makeNewContent(rootCat);
	//outSummary.textContent = JSON.stringify(content, null, "\t");
	outSummary.textContent = JSON.stringify(content, jsonReplacer, "\t");
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
	if(!event || !event.target) return false;
	event.target.normalize();
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
		event.target.classList?.remove?.("invalid");
		/* modRules = null;
		await loadRulesModule(txtRulesSource.textContent); */
		if(modRules) loadCategoryList();
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

		const rootCat = randomFromList(modRules.fieldInstances.category);
		const content = makeNewContent(rootCat);
		//outSummary.textContent = JSON.stringify(content, null, "\t");
		outSummary.textContent = JSON.stringify(content, jsonReplacer, "\t");
	} catch(error) {
		outSummary.textContent = "Couldn't use rules module.\n" + error.message;
	}
}
