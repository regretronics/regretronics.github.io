"use strict";

//  idea: have a "reload script" button?
//I'm putting height before width, because x is subordinate to y in raster scan.
var c2d, ch, cw, imgData;
var canvasScale = 1;
var frameCount = 0, renderTimeSum = 0, updateCycleId = 0;

const posInc = 16;
const scaleStep = 2 ** 0.0625;
const inputKeyMap = {
	"KeyA": {action: () => {cx -= scale * posInc;}},
	"KeyD": {action: () => {cx += scale * posInc;}},
	"KeyW": {action: () => {cy -= scale * posInc;}},
	"KeyS": {action: () => {cy += scale * posInc;}},

	"ArrowLeft": {action: () => {cx -= scale * posInc;}},
	"ArrowRight": {action: () => {cx += scale * posInc;}},
	"ArrowUp": {action: () => {cy -= scale * posInc;}},
	"ArrowDown": {action: () => {cy += scale * posInc;}},

	"ShiftLeft": {action: () => {scale /= scaleStep;}},
	"ShiftRight": {action: () => {scale /= scaleStep;}},
	"ControlLeft": {action: () => {scale *= scaleStep;}},
	"ControlRight": {action: () => {scale *= scaleStep;}},

	"PageUp": {action: () => {scale /= 2;}},
	"PageDown": {action: () => {scale *= 2;}},
};
function navKeyDown(event) {
	//console.log(event);
	const keyRec = inputKeyMap[event.code] ?? inputKeyMap[event.key];
	if(keyRec) keyRec.value = 1;
}
function navKeyUp(event) {
	const keyRec = inputKeyMap[event.code] ?? inputKeyMap[event.key];
	if(keyRec) keyRec.value = 0;
}

function drawInit() {
	if(mainCanvas.getContext) {
		//c2d = mainCanvas.getContext('2d');
		c2d = mainCanvas.getContext('2d', {alpha: false});
		//c2d.globalAlpha = 1;
		//c2d.imageSmoothingEnabled = false;

		ch = mainCanvas.height;
		cw = mainCanvas.width;

		canvasSizeChanged();
		viewUpdate();
		setTimeout(startUpdating, 1000);
	} else {
		btnViewUpdate.disabled = true;
		btnStartUpdating.disabled = true;
		cbxCanvasScale.disabled = true;
	}
}
function pageLoaded(event) {
	for(const s of document.querySelectorAll('[id]'))
		window[s.id] = s;

	cbxCanvasScale.addEventListener("change", canvasScaleChanged);
	btnViewUpdate.addEventListener("click", viewUpdate);
	btnStartUpdating.addEventListener("click", startUpdating);
	btnStopUpdating.addEventListener("click", stopUpdating);
}
function pageReady(event) {
	drawInit();
	document.addEventListener("keydown", navKeyDown);
	document.addEventListener("keyup", navKeyUp);
	window.addEventListener("blur", stopUpdating);
}
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
