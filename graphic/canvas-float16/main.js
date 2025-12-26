"use strict";

//var cw, ch, mainCanvas, ctx;
var canUpdate = false;
var aspectRatio, resMagnitude; //, canvasScale = 1;
var colorSpace, bgIntensity, spotIntensity, spotSize;

function log2WithFactor3(x) {
	const
		thres3_2Log = 0.5 * Math.log2(1.5),
		roundThres = 0.5 - thres3_2Log,
		magnitudeF = Math.log2(x),
		magnitudeI = Math.floor(magnitudeF + roundThres),
		remainder = Number((magnitudeF - magnitudeI) >= thres3_2Log);
	return 2 * magnitudeI + remainder;
}
function exp2WithFactor3(x) {
	const magnitude = Math.floor(x * 0.5), mod = x - 2 * magnitude;
	return 2 ** magnitude * [1, 1.5][mod];
}

function cbxCanvasRatioChanged(event) {
	const elem = event.target;
	const newAspectRatio = elem.value.split("_");
	aspectRatio = [parseInt(newAspectRatio[0]), parseInt(newAspectRatio[1])];
	recalcResolution();
}
function rngCanvasResolutionInput(event) {
	const elem = event.target;
	resMagnitude = elem.valueAsNumber;
	recalcResolution();
}
function btnResClick(event) {
	if(!event || !event.target) return;
	const ctl = event.target;
	resMagnitude += Number(ctl.dataset.delta);
	rngCanvasResolution.valueAsNumber = resMagnitude;
	recalcResolution();
}

function selColorSpaceInput(event) {
	if(!event || !event.target) return;
	const elem = event.target;
	colorSpace = elem.value;
	viewUpdate();
}
function expSpinnerChanged(event) {
	//console.log(event);
	const elem = event.target;
	if(!elem) return false;

	//let val = elem.valueAsNumber;
	let val = Number(elem.value);
	if(isNaN(val)) {
		val = 1;
		elem.classList.add("invalid");
		elem.setCustomValidity("Input not recognized as a real number.");
	} else {
		elem.classList.remove("invalid");
		elem.setCustomValidity("");
	}

	const magnitude = Math.round(Math.log2(Math.abs(val)));
	let stepRatio = parseFloat(elem.dataset.stepRatio);
	if(stepRatio === undefined || isNaN(stepRatio)) stepRatio = 0.25;
	const
		step = stepRatio * 2 ** magnitude,
		dynMin = val - 2 * Math.sign(val) * step,
		min = parseFloat(elem.dataset.min);
	if(min === undefined || isNaN(min)) {
		elem.step = step;
		elem.min = dynMin;
	} else {
		elem.step = Math.max(min, step);
		elem.min = Math.max(min, dynMin);
	}
}
function txtBackgroundIntensityInput(event) {
	const elem = event.target;
	bgIntensity = elem.valueAsNumber;
	//localStorage.setItem("bgIntensity", bgIntensity);
	viewUpdate();
}
function txtSpotIntensityInput(event) {
	const elem = event.target;
	spotIntensity = elem.valueAsNumber;
	//localStorage.setItem("spotIntensity", spotIntensity);
	viewUpdate();
}
function rngSpotSizeInput(event) {
	const elem = event.target;
	spotSize = Math.pow(2, elem.valueAsNumber);
	//localStorage.setItem("spotSize", spotSize);
	outSpotSize.innerText = spotSize.toPrecision(3);
	viewUpdate();
}
//recursive function
function cloneObject(obj) {
	if(!obj || typeof obj !== "object") return obj;
	const objClone = {};
	for(const key in obj) {
		//if(Object.prototype.hasOwnProperty.call(scr, key)) {
			const element = obj[key];
			objClone[key] = (typeof obj === "object") ? cloneObject(element) : element;
		//}
	}
	return objClone;
}
async function screenDetailed(ctl) {
	const scr = (await window.getScreenDetails()).currentScreen;
	const screenClone = cloneObject(scr);
	ctl.innerText = JSON.stringify(screenClone, null, '\t');
}
function btnScreenDetailsClick(event) {
	/* getScreenDetails().then(obj => {
		outScreenInfo.innerText = JSON.stringify(obj, null, '\t');
	}); */
	screenDetailed(outScreenInfo);
}

function pageLoaded() {
	for(const elem of document.querySelectorAll('[id]'))
		window[elem.id] = elem;

	const evt = new Event("input");
	for(const elem of document.querySelectorAll("input.exp")) {
		elem.addEventListener("input", expSpinnerChanged);
		//elem.addEventListener("invalid", expSpinnerInvalid);
		elem.dispatchEvent(evt);
	}

	cbxCanvasRatio.addEventListener("change", cbxCanvasRatioChanged);
	rngCanvasResolution.addEventListener("input", rngCanvasResolutionInput);

	/* let s;
	if(s = localStorage.getItem("canvas.aspectRatio")) {
		aspectRatio = JSON.parse(s);
		cbxCanvasRatio.value = aspectRatio.join("_");
		//+?
	} else {
		const newAspectRatio = cbxCanvasRatio.value.split("_");
		aspectRatio = [parseInt(newAspectRatio[0]), parseInt(newAspectRatio[1])];
	}
	if(s = localStorage.getItem("canvas.resMagnitude")) {
		resMagnitude = JSON.parse(s);
		rngCanvasResolution.valueAsNumber = resMagnitude;
	} else {
		resMagnitude = rngCanvasResolution.valueAsNumber;
	} */
	const newAspectRatio = cbxCanvasRatio.value.split("_");
	aspectRatio = [parseInt(newAspectRatio[0]), parseInt(newAspectRatio[1])];
	resMagnitude = rngCanvasResolution.valueAsNumber;
	recalcResolution();

	btnResDiv2.addEventListener("click", btnResClick);
	btnResMul2.addEventListener("click", btnResClick);
	cbxCanvasScale.addEventListener("change", canvasScaleChanged);
	
	/* if(s = localStorage.getItem("layerCount")) {
		layerCount = JSON.parse(s);
		
		txtMarchingLayers.valueAsNumber = layerCount;
		rngMarchingLayers.valueAsNumber = log2WithFactor3(layerCount);
		} else
			layerCount = txtMarchingLayers.valueAsNumber; */

	selColorSpace.addEventListener("input", selColorSpaceInput);
	txtBackgroundIntensity.addEventListener("input", txtBackgroundIntensityInput);
	txtSpotIntensity.addEventListener("input", txtSpotIntensityInput);
	rngSpotSize.addEventListener("input", rngSpotSizeInput);
	selColorSpaceInput({target: selColorSpace});
	txtBackgroundIntensityInput({target: txtBackgroundIntensity});
	txtSpotIntensityInput({target: txtSpotIntensity});
	rngSpotSizeInput({target: rngSpotSize});

	btnScreenDetails.addEventListener("click", btnScreenDetailsClick);
}
function pageReady() {
	canUpdate = true;
	viewUpdate();

	//const boolToStrArr = ["no", "yes"];
	const boolToStr = {false: "no", true: "yes"};
	outFeatureSupport.innerText = `Canvas supported: ${boolToStr[Boolean(ctx) || Boolean(CanvasRenderingContext2D)]}.`;
	if(ctx) {
		const attributes = ctx.getContextAttributes();
		if(attributes.colorSpace)
			outFeatureSupport.innerText += `\nCustom color space: ${boolToStr[attributes.colorSpace !== "srgb"]} (${attributes.colorSpace}).`;
		else
			outFeatureSupport.innerText += `\nCustom color space: ${boolToStr[false]}.`;
		if(attributes.colorType)
			outFeatureSupport.innerText += `\nCustom color type: ${boolToStr[attributes.colorType !== "unorm8"]} (${attributes.colorType}).`;
		else
			outFeatureSupport.innerText += `\nCustom color type: ${boolToStr[false]}.`;
	}

	const screenClone = cloneObject(screen);
	screenClone.devicePixelRatio = window.devicePixelRatio;
	outScreenInfo.innerText = JSON.stringify(screenClone, null, '\t');

	/* if(!("getScreenDetails" in window))
		btnScreenDetails.parentElement.hidden = true; */
	if("getScreenDetails" in window) {
		btnScreenDetails.innerText = "Get current screen details";
		btnScreenDetails.disabled = false;
	}
}

//window.addEventListener("DOMContentLoaded", pageLoaded);
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
