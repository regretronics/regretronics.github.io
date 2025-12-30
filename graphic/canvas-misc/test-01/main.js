"use strict";

//idea: have a "reload script" button?
var c2d;
//I'm putting height before width, because x is subordinate to y in raster scan.
var ch, cw, imgData;
var canvasScale = 1;
var frameCount = 0, renderTimeSum = 0, updateCycleId = 0;

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
		setTimeout(startUpdating, 5000);
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

	drawInit();
}
window.addEventListener("load", pageLoaded);
