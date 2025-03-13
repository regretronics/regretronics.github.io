"use strict";

/* //this is getting too generalized/complicated
const changeLinear = (current, change) => (current + change);
const conditionGreaterEq = (current, threshold) => (current >= threshold);
const gameOperations = [
	{
		title: "False reward",
		reqs: [
			{field: "counter", thresholdFunc: conditionGreaterEq, thresholdVal: 256, changeFunc: changeLinear, changeVal: -256},
		],
		effects: [
			{field: "counterInc", changeFunc: changeLinear, changeVal: 1, adjustFunc: null, adjustVal: null},
		],
	},
]; */
//currently the only difference between costs and rewards is that costs are also prerequisites (rewards are not checked for amount present)
const gameTrades = [
	{
		title: "False reward",
		costs: [
			{field: "counter", change: -256},
		],
		rewards: [
			{field: "counterInc", change: 1},
		],
	},
	{
		title: "Pure regret",
		costs: [
			{field: "counterInc", change: -1},
		],
		rewards: [
			{field: "counter", change: 128},
		],
	},
];

//redo the UI about trades
function loadTrades(targetList) {
	targetList.innerHTML = ""; //empty previous contents

	for(const key in gameTrades) {
		if(!Object.prototype.hasOwnProperty.call(gameTrades, key)) continue;
		const trade = gameTrades[key];

		const tradeElem = targetList.appendChild(document.createElement("li")); //a trade
		const tradeTitle = tradeElem.appendChild(document.createElement("label"));
		tradeTitle.textContent = trade.title;
		tradeTitle.htmlFor = "btnTradeOrder" + key;
		tradeTitle.classList.add("trade-title");
		tradeElem.appendChild(document.createTextNode(" "));

		const btnTradeOrder = tradeElem.appendChild(document.createElement("button"));
		btnTradeOrder.id = "btnTradeOrder" + key;
		btnTradeOrder.textContent = "Order";
		btnTradeOrder.addEventListener("click", btnTradeOrderClick);
		btnTradeOrder.dataset["tradeIdx"] = key;

		const lstTradeFeatures = tradeElem.appendChild(document.createElement("ul")); //features of a trade
		lstTradeFeatures.classList.add("trade-features-list");
		const enumFeatures = function(list, featureClass) {
			for (const item of list) {
				const featureElem = lstTradeFeatures.appendChild(document.createElement("li")); //feature

				const featureField = featureElem.appendChild(document.createElement("span"));
				featureField.textContent = featureClass;
				featureField.classList.add("field");

				featureElem.appendChild(document.createTextNode(": "));

				const featureValue = featureElem.appendChild(document.createElement("span"));
				featureValue.textContent = gameStateFields[item.field].title + ", " + item.change.toString();
				featureValue.classList.add("value");
			}
		}
		enumFeatures(trade.costs, "Cost");
		enumFeatures(trade.rewards, "Reward");
	}
}
function btnTradeOrderClick(event) {
	if(!event || !event.target) return;

	//get the data structure of a trade
	const tradeIdx = parseFloat(event.target.dataset["tradeIdx"]);
	if(tradeIdx === NaN) return;
	const tradeObj = gameTrades[tradeIdx];
	if(!tradeObj) return;

	//get the requisites and check their presence; quits if some are not present
	for(const cost of tradeObj.costs) {
		let costVal = cost.change ?? -1;
		if(costVal === NaN) costVal = -1;
		//if(gameState[cost.field] < -costVal) return;
		if(getStateField(cost.field) < -costVal) return;
	}

	//apply costs and rewards
	for(const cost of tradeObj.costs) {
		let costVal = cost.change ?? -1;
		if(costVal === NaN) costVal = -1;
		//gameState[cost.field] = gameState[cost.field] + costVal;
		setStateField(cost.field, getStateField(cost.field) + costVal);
	}
	for(const reward of tradeObj.rewards) {
		let rewardVal = reward.change ?? 1;
		if(rewardVal === NaN) rewardVal = 1;
		//gameState[reward.field] = gameState[reward.field] + rewardVal;
		setStateField(reward.field, getStateField(reward.field) + rewardVal);
	}
}
