"use strict";

var storageCanWrite = false;

function saveData(field, value) {
	if(!storageCanWrite) return;
	localStorage.setItem("gameIdle." + field, JSON.stringify(value));
}
function eraseData(field) {
	localStorage.removeItem(field);
	localStorage.removeItem("gameIdle." + field);
}
function resetStorage() {
	//localStorage.clear();
	//eraseData("counter");
	//eraseData("counterInc");
	//eraseData("cycleInterval");
	for(const field in gameState) {
		//if(Object.prototype.hasOwnProperty.call(gameState, field))
		eraseData(field);
		eraseData("state." + field);
	}
	//eraseData("rndArticleBuffer"); //?
}
function loadFromStorage() {
	try {
		storageCanWrite = false; //inhibit storing feedback in setters
		const retrieve = function(field, continuation) {
			let s = localStorage.getItem("gameIdle." + field);
			if(!s) {
				s = localStorage.getItem(field);
				if(s) {
					localStorage.removeItem(field);
					localStorage.setItem("gameIdle." + field, s);
				}
			}
			if(s) continuation(JSON.parse(s));
		};
		
		//deprecated
		retrieve("counter", v => {setStateField("counter", v);});
		retrieve("counterInc", v => {setStateField("counterInc", v);});
		retrieve("cycleInterval", v => {setStateField("cycleIntervalMs", 1000 * v);});
		eraseData("counter");
		eraseData("counterInc");
		eraseData("cycleInterval");
		
		//take values from all stored game state fields
		for(let i = 0; i < localStorage.length; i++) {
			const field = localStorage.key(i);
			if(!field.startsWith("gameIdle.state.")) continue;
			const s = localStorage.getItem(field);
			if(s) setStateField(field.replace("gameIdle.state.", ""), JSON.parse(s));
		}

		retrieve("gameRunning", v => {gameRunning = v;});
		retrieve("rndArticleBuffer", v => {rndArticleBuffer = v;});
		retrieve("boxGameState.open", v => {boxGameState.open = v;});
		retrieve("boxTrades.open", v => {boxTrades.open = v;});
		retrieve("boxWpRndArticle.open", v => {boxWpRndArticle.open = v;});
		retrieve("wpRunning", v => {wpRunning = v;});
	} finally {
		storageCanWrite = true;
	}
}
