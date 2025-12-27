"use strict";
//const scaleValues = {"1_1": 1; };

function selScaleChanged(event) {
	const elem = event.target;
	if(!elem) {return;}
	imageScaleUpdate(elem.value, imgSource);
	imageScaleUpdate(elem.value, cnvOutput);
}
function imageScaleUpdate(ratioStr, target) {
	if(!outputC2d || !target) {return;}

	let ratio = ratioStr.split("_");
	ratio = [parseInt(ratio[0]), parseInt(ratio[1])];
	if(isNaN(ratio[0]) || isNaN(ratio[1])) {return;}

	const newScale = ratio[1] / ratio[0];
	if(!isFinite(newScale) || newScale == 0) {return;}

	target.imageScale = newScale;
	const w = (target.tagName.toLowerCase() == "img" ? target.naturalWidth : target.width);
	//target.style.height = (newScale * target.height).toString() + "px";
	target.style.width = (newScale * w).toString() + "px";
}

function canvasSizeChanged(cnvOutput) {
	if(!outputC2d) {return;}
	imageScaleUpdate(selSourceScale.value, cnvOutput);

	//to do: use ImageData() constructor instead of CanvasRenderingContext2D.createImageData()?
	/*imgData = outputC2d.createImageData(cw, ch);

	//pre-fill alpha
	const data = imgData.data, l = data.length;
	for(let i = 3; i < l; i += 4)
		data[i] = 255;*/
}

function canvasSizeUpdate(cnvOutput, newCH, newCW) {
	if(isNaN(newCH) || isNaN(newCW)) {return;}
	newCH |= 0;
	newCW |= 0;
	if(newCH <= 0 || newCW <= 0) {return;}

	if(newCH != ch || newCW != cw) {
		ch = newCH;
		cw = newCW;
		cnvOutput.height = ch;
		cnvOutput.width = cw;
		canvasSizeChanged(cnvOutput);
	}
}
