"use strict";

const gameStateFields = {
	counter: {
		titleLong: "The counter",
		title: "counter",
		listed: true,
	},
	counterInc: {
		titleLong: "The counter increment",
		title: "counter inc",
		listed: true,
	},
	cycleIntervalMs: {
		listed: false,
	}
};
const gameStateInitial = {
	counter: 0,
	counterInc: 1,
	cycleIntervalMs: 1000,
};

//var gameState = {}; //central state structure
var gameState = Object.assign({}, gameStateInitial);
function getStateField(field) {
	return gameState[field];
}
function setStateField(field, value) {
	gameState[field] = value;
	saveData("state." + field, value); //persistence

	//update UI
	if(!gameStateFields[field].listed) return;
	const outElem = document.querySelector('[data-field="' + field + '"] > .value');
	if(outElem) outElem.textContent = value.toString();
}
//redo the UI about state
function loadStateList(targetList) {
	targetList.innerHTML = ""; //empty previous contents

	for(const field in gameState) {
		if(!Object.prototype.hasOwnProperty.call(gameState, field)) continue;
		if(!gameStateFields[field].listed) continue;
		const value = gameState[field];

		const fieldElem = targetList.appendChild(document.createElement("li")); //a state field
		fieldElem.dataset["field"] = field;

		//const fieldTitle = fieldElem.appendChild(document.createElement("label"));
		const fieldTitle = fieldElem.appendChild(document.createElement("span"));
		fieldTitle.classList.add("title");
		fieldTitle.textContent = gameStateFields[field].titleLong ?? gameStateFields[field].title ?? field;
		fieldTitle.title = gameStateFields[field].title ?? field;
		//fieldTitle.htmlFor = "outField-" + field;
		fieldElem.appendChild(document.createTextNode(": "));

		const fieldValue = fieldElem.appendChild(document.createElement("output"));
		fieldValue.classList.add("value");
		fieldValue.textContent = value.toString(); //to do: ...generalize this
	}
}
function updateStateValues(targetList) {
	//to do: less destructive variation
}

var idleTimer = null; //used to control pending updates
var gameRunning = true, wpRunning = true;
function idleCycle() {
	if(!gameRunning) { //cancel
		idleTimer = null;
		return;
	}
	idleTimer = setTimeout(idleCycle, getStateField("cycleIntervalMs")); //perpetuate

	//calculations
	//gameState.counter = gameState.counter + gameState.counterInc;
	setStateField("counter", getStateField("counter") + getStateField("counterInc"));

	//random article pumping
	if(!document.hidden && wpRunning) WpRndNextArticle();
}
function startGameCycle() {
	if(gameRunning) idleTimer = setTimeout(idleCycle, getStateField("cycleIntervalMs"));
}

function btnGameResetClick(event) {
	if(!confirm("Please confirm if you are dumb.")) return;

	if(idleTimer) {
		clearTimeout(idleTimer);
		idleTimer = null;
	}
	resetStorage();

	//reset proper, to initial values
	storageCanWrite = true;
	//gameState = Object.assign({}, gameStateInitial); //setters missing
	gameState = {};
	for(const field in gameStateInitial)
		if(Object.prototype.hasOwnProperty.call(gameStateInitial, field)) {
			const value = gameStateInitial[field];
			//gameState[field] = value;
			setStateField(field, value);
		}

	//finally restart the game cycle
	startGameCycle();
}
function chkGameRunningClick(event) {
	gameRunning = chkGameRunning.checked;
	saveData("gameRunning", gameRunning);
	if(!idleTimer) startGameCycle();
}
function detailsToggleSave(event) {
	if(!event || !event.target) return;
	//saveData(event.target.id + ".open", event.newState.startsWith("open"));
	saveData(event.target.id + ".open", event.target.open);
}
function chkWpRunningClick(event) {
	wpRunning = chkWpRunning.checked;
	saveData("wpRunning", wpRunning);
}

function pageLoaded(event) {
	//starting point for hue of color scheme
	document.documentElement.style.setProperty("--hue-phase", Math.random() + "turn");

	//load HTML element references (renders document.getElementById unnecessary)
	for(let s of document.querySelectorAll("[id]"))
		window[s.id] = s;
}
function pageReady(event) {
	try {
		loadFromStorage();
	} catch(error) {
	}

	//update or load things in the user interface
	loadStateList(lstStateFields);
	chkGameRunning.checked = gameRunning;
	chkWpRunning.checked = wpRunning;
	loadTrades(lstTrades);

	//trap UI changes
	btnGameReset.addEventListener("click", btnGameResetClick);
	//txtParam01.addEventListener("input", txtParam01Input);
	chkGameRunning.addEventListener("click", chkGameRunningClick);
	boxGameState.addEventListener("toggle", detailsToggleSave);
	boxTrades.addEventListener("toggle", detailsToggleSave);
	boxWpRndArticle.addEventListener("toggle", detailsToggleSave);
	chkWpRunning.addEventListener("click", chkWpRunningClick);

	//start main game functions
	WpRndNextArticle();
	startGameCycle();
}
//window.addEventListener("DOMContentLoaded", pageLoaded);
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
