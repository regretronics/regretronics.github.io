"use strict";

var ch, cw;
var canvasScale;
var frameCount, renderTimeSum, segmentCount;
var firstTimeout, updateCycleId, animating;

//const requires ECMAScript 6/2015.
//const scaleValues = {"1_1": 1; };

function canvasScaleChanged() {
	var newCanvasScale = cbxCanvasScale.value.split("_");
	newCanvasScale = [parseInt(newCanvasScale[0]), parseInt(newCanvasScale[1])];
	//isNaN and isFinite require ECMAScript 6/2015.
	if(isNaN(newCanvasScale[0]) || isNaN(newCanvasScale[1])) return;
	newCanvasScale = newCanvasScale[1] / newCanvasScale[0];
	if(!isFinite(newCanvasScale) || newCanvasScale == 0) return;

	canvasScale = newCanvasScale;
	//mainCanvas.style.height = canvasScale * ch + "px";
	mainCanvas.style.width = canvasScale * cw + "px";
}

function canvasSizeCheck() {
	let newCH = parseInt(txtResH.value);
	let newCW = parseInt(txtResW.value);
	//isNaN requires ECMAScript 6/2015.
	if(isNaN(newCH) || isNaN(newCW)) return false;
	newCH |= 0;
	newCW |= 0;
	if(newCH <= 0 || newCW <= 0) return false;
	if(newCH === ch && newCW === cw) return false; 

	ch = newCH;
	cw = newCW;
	if(gpu) {
		gpu.destroy();
		gpu = undefined;
	}
	restartGPU();
	if(gpu) {
		registerKernels();
		worldVoxelsInit();

		if(canvasContainer.firstElementChild) canvasContainer.firstElementChild.remove();
		mainCanvas = renderAccum.canvas;
		canvasContainer.appendChild(mainCanvas);

		viewRayDirsCompute_Rectilinear(ch, cw);
	}
	canvasScaleChanged();
	return true;
}

const defTimeout = 1000;
var timeout = defTimeout;

function viewUpdate() {
	canvasSizeCheck();
	//if(frameCount) kinematicsRefresh();

	timeout = parseFloat(txtFrameTimeout.value);
	if(isNaN(timeout)) timeout = defTimeout;

	let t = performance.now();
	//frameRenderRaycasting(mainCanvas, timeout);
	frameRenderRaycasting(ch, cw, timeout);
	t = performance.now() - t;

	outFrameRenderT.innerText = t.toFixed(1);
	//outFrameSegs.innerText = segmentCount.toString();
	//outFrameLayers.innerText = (segmentCount / ch / cw).toPrecision(4);
	outFrameLayers.innerText = layerCount.toString();
	//let segTime = 1000000.0 * t / segmentCount; //milliseconds to nanoseconds
	let segTime = 1000000.0 * t / (layerCount * ch * cw); //milliseconds to nanoseconds
	outSegTime.innerText = segTime.toPrecision(5);

	frameCount++;
	renderTimeSum += segTime;
	outFrameCount.innerText = frameCount.toString();
	outSegTAvg.innerText = (renderTimeSum / frameCount).toPrecision(5);
	
	let i = Math.floor(3 * Math.random());
	clientPos[i] = (clientPos[i] + 0.5 * (Math.random() - 0.5)) % worldRes[i];
	
	//window.requestAnimationFrame(viewUpdate);
	if(animating) updateCycleId = setTimeout(viewUpdate, Math.max(timeout - t, 0));
}

function startUpdating() {
	firstTimeout = 0;
	if(!animating || updateCycleId) return;
	//updateCycleId = setInterval(viewUpdate, 250);
	timeout = parseFloat(txtFrameTimeout.value);
	if(isNaN(timeout)) timeout = defTimeout;
	updateCycleId = setTimeout(viewUpdate, timeout);
}

function stopUpdating() {
	animating = false;
	if(firstTimeout) {
		clearTimeout(firstTimeout);
		firstTimeout = 0;
	}
	if(!updateCycleId) return;
	clearInterval(updateCycleId);
	updateCycleId = 0;
}
