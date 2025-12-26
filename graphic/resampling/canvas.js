"use strict";
//const scaleValues = {"1_1": 1; };

function cbxScaleChanged(event) {
	const elem = event.target;
	if(!elem || !elem.dataset) return;
	const id = elem.dataset["image"];
	if(!id) return;
	imageScaleUpdate(elem, document.getElementById(id));
}
function imageScaleUpdate(cbx, cnv) {
	if(!outputC2d || !cbx || !cnv) {return;}

	let ratio = cbx.value.split("_");
	ratio = [parseInt(ratio[0]), parseInt(ratio[1])];
	if(isNaN(ratio[0]) || isNaN(ratio[1])) {return;}

	const newScale = ratio[1] / ratio[0];
	if(!isFinite(newScale) || newScale == 0) {return;}

	cnv.imageScale = newScale;
	const w = (cnv.tagName.toLowerCase() == "img" ? cnv.naturalWidth : cnv.width);
	//cnv.style.height = (newScale * cnv.height).toString() + "px";
	cnv.style.width = (newScale * w).toString() + "px";
}

function canvasSizeChanged() { //delete?
	if(!outputC2d) {return;}
	imageScaleUpdate(cbxOutputScale, cnvOutput);

	//to do: use ImageData() constructor instead of CanvasRenderingContext2D.createImageData()?
	/*imageData = outputC2d.createImageData(cw, ch);

	//pre-fill alpha
	const data = imageData.data, l = data.length;
	for(let i = 3; i < l; i += 4)
		data[i] = 255;*/
}

function canvasSizeUpdate() {
	let newCH = parseInt(txtOutputResH.value);
	let newCW = parseInt(txtOutputResW.value);
	if(isNaN(newCH) || isNaN(newCW)) {return;}
	newCH |= 0;
	newCW |= 0;
	if(newCH <= 0 || newCW <= 0) {return;}

	if(newCH != ch || newCW != cw) {
		ch = newCH;
		cw = newCW;
		cnvOutput.height = ch;
		cnvOutput.width = cw;
		canvasSizeChanged();
	}
}
