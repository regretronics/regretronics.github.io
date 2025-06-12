"use strict";
//const requires ECMAScript 6/2015.
//const scaleValues = {"1_1": 1; };

function canvasScaleChanged() {
	if(!c2d) return;
	let newCanvasScale = cbxCanvasScale.value.split("_");
	newCanvasScale = [parseInt(newCanvasScale[0]), parseInt(newCanvasScale[1])];
	//isNaN and isFinite requires ECMAScript 6/2015.
	if(isNaN(newCanvasScale[0]) || isNaN(newCanvasScale[1])) return;
	newCanvasScale = newCanvasScale[1] / newCanvasScale[0];
	if(!isFinite(newCanvasScale) || (newCanvasScale == 0)) return;

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
	for(let i = 0; i < l; i += 4)
		data[i + 3] = 255;
}

function canvasSizeUpdate() {
	let newCH = parseInt(txtResH.value);
	let newCW = parseInt(txtResW.value);
	//isNaN requires ECMAScript 6/2015.
	if(isNaN(newCH) || isNaN(newCW)) return;
	newCH |= 0;
	newCW |= 0;
	if((newCH <= 0) || (newCW <= 0)) return;

	if((newCH != ch) || (newCW != cw)) {
		ch = newCH;
		cw = newCW;
		mainCanvas.height = ch;
		mainCanvas.width = cw;
		canvasSizeChanged();
	}
}

var cx = 0, cy = 0, scale = 0.0625;
function viewUpdate() {
	if(!c2d) return;
	canvasSizeUpdate();
	if(!imgData) return;
	//if(frameCount) {kinematicsRefresh();}

	for(const inputKey in inputKeyMap) {
		const inputObj = inputKeyMap[inputKey];
		if(inputObj.value >= 1) inputObj.action();
	}

	let t = Date.now();
	//frameRenderSimple(imgData);
	frameRenderNoise2(imgData, cx, cy, scale);
	//frameRender(imgData);
	c2d.putImageData(imgData, 0, 0);
	t = Date.now() - t;
	frameCount++;
	renderTimeSum += t;
	outFrameRenderT.innerText = t.toString();
	outFrameRenderTAvg.innerText = (renderTimeSum / frameCount).toFixed(2);
	outFrameCount.innerText = frameCount.toString();

	//alert("breakpoint");
	//window.requestAnimationFrame(viewUpdate);
}

function startUpdating() {
	if(updateCycleId) return;
	if(!(c2d && imgData)) return;
	updateCycleId = setInterval(viewUpdate, 200);
}

function stopUpdating() {
	if(!updateCycleId) return;
	clearInterval(updateCycleId);
	updateCycleId = 0;
}
