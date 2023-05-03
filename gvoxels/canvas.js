"use strict";

var c2d, ch, cw, imgData;
var canvasScale;
var frameCount, renderTimeSum, segmentCount;
var firstTimeout, updateCycleId, animating;

//const requires ECMAScript 6/2015.
//const scaleValues = {"1_1": 1; };

function canvasScaleChanged() {
	if(!c2d) {return;}
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

function canvasSizeChanged() {
	if(!c2d) return;
	canvasScaleChanged();

	//to do: use ImageData() constructor instead of CanvasRenderingContext2D.createImageData()?
	imgData = c2d.createImageData(cw, ch);

	//pre-fill alpha
	let data = imgData.data, l = data.length;
	for(let i = 0; i < l; i += 4) data[i + 3] = 255;
}

function canvasSizeUpdate() {
	let newCH = parseInt(txtResH.value);
	let newCW = parseInt(txtResW.value);
	//isNaN requires ECMAScript 6/2015.
	if(isNaN(newCH) || isNaN(newCW)) return;
	newCH |= 0;
	newCW |= 0;
	if(newCH <= 0 || newCW <= 0) return;

	if(newCH != ch || newCW != cw) {
		ch = newCH;
		cw = newCW;
		mainCanvas.height = ch;
		mainCanvas.width = cw;
		viewRayDirsCompute_Rectilinear(ch, cw);
		canvasSizeChanged();
	}
}

var timeout = 1000;

function viewUpdate() {
	if(!c2d) return;
	canvasSizeUpdate();
	if(!imgData) return;
	//if(frameCount) kinematicsRefresh();

	//frameRenderSimple(imgData);
	if(rayCrossingPoints == undefined || rayCrossingPoints.length != ch * cw * 4)
		rayCrossingPoints = new Float32Array(ch * cw * 4);
	if(rayDead == undefined || rayDead.length != ch * cw)
		//rayDead = new Array(ch * cw);
		rayDead = new Int8Array(ch * cw);
		//rayDead = new Int32Array(ch * cw);
	if(rowDead == undefined || rowDead.length != ch)
		//rowDead = new Array(ch);
		rowDead = new Int8Array(ch);
		//rowDead = new Int32Array(ch);
	//if(rayPosColor == undefined || rayPosColor.length != ch * cw * 3 * 2)
	//	rayPosColor = new Float32Array(ch * cw * 3 * 2); //?
	if(accumBuffer == undefined || accumBuffer.length != ch * cw * 3 * 2)
		accumBuffer = new Float32Array(ch * cw * 3 * 2);
	timeout = parseFloat(txtFrameTimeout.value);
	if(isNaN(timeout)) timeout = 1000; //default

	let t = Date.now();
	frameRenderRaycasting(imgData, timeout);
	c2d.putImageData(imgData, 0, 0);
	t = Date.now() - t;

	outFrameRenderT.innerText = t.toString();
	//outFrameSegs.innerText = segmentCount.toString();
	outFrameLayers.innerText = (segmentCount / ch / cw).toPrecision(4);
	let segTime = 1000000.0 * t / segmentCount;
	outSegTime.innerText = segTime.toPrecision(5);

	frameCount++;
	renderTimeSum += segTime;
	outFrameCount.innerText = frameCount.toString();
	outFrameRenderTAvg.innerText = (renderTimeSum / frameCount).toPrecision(5);
	
	let i = Math.floor(3 * Math.random());
	clientPos[i] = (clientPos[i] + 0.5 * (Math.random() - 0.5)) % worldRes[i];
	
	//console.debug("breakpoint");
	//window.requestAnimationFrame(viewUpdate);
	if(animating) updateCycleId = setTimeout(viewUpdate, Math.max(timeout - t, 0));
}

function startUpdating() {
	firstTimeout = 0;
	if(!animating || updateCycleId) return;
	if(!(c2d && imgData)) return;
	//updateCycleId = setInterval(viewUpdate, 250);
	timeout = parseFloat(txtFrameTimeout.value);
	if(isNaN(timeout)) timeout = 1000; //default
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
