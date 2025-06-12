"use strict";
//note: as of 2022-09 browsers only support 8 bits per channel in raster/bitmap images; deep color and hdr pixel formats are not yet available for script manipulation.
//to do: multiple iterations of resampling at once.
//to do: visualize in a chart a custom cross-section of color variation.
//to do: hardware acceleration, probably through three.js and a shader.

function imgSourceLoaded(event) {
	imageScaleUpdate(cbxSourceScale, imgSource);
	sh = event.target.naturalHeight;
	sw = event.target.naturalWidth;

	outSourceRes.textContent = `${sw}x${sh}`;
	window.setTimeout(encodeImage, 100, event.target);
}
const factor = 2, factorInv = 1 / factor, factorInv2 = factorInv * factorInv;
function encodeImage(image) {
	//to do: ...OffscreenCanvas (not supported in Firefox as of 2022-09)
	//const offscreen = new OffscreenCanvas(sw, sh);
	if(!cnvSource || !cnvSource.getContext) return;
	cnvSource.height = sh;
	cnvSource.width = sw;

	//sourceC2d = cnvSource.getContext('2d');
	//sourceC2d = cnvSource.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
	sourceC2d = cnvSource.getContext('2d', {alpha: false});
	//sourceC2d.globalAlpha = 1;
	//sourceC2d.imageSmoothingEnabled = false;

	scalePixels = [];
	sourceC2d.drawImage(image, 0, 0);
	//try {
		imageSourceData = sourceC2d.getImageData(0, 0, sw, sh);
	//} catch {}
	//} catch(e) {}

	//scalePixels.push(new Float32Array());
	//question: change push() for unshift() (reverses the array order)?
	const b8ToFloatScale = 1 / 255;
	scalePixels.push({h: sh, w: sw, dataFloat: Float32Array.from(imageSourceData.data, x => x * b8ToFloatScale)});
	//question: subtract 0.5 from color values? (currently no)

	//Convert to gray
	let buf = scalePixels[0].dataFloat;
	for(let sy = 0, sy2, sx, sx2; sy < sh; sy++) {
		sy2 = sw * sy;
		for(sx = 0; sx < sw; sx++) {
			sx2 = 4 * (sy2 + sx);
			let gray = (buf[sx2] + buf[sx2 + 1] + buf[sx2 + 2]) / 3;
			buf[sx2++] = gray;
			buf[sx2++] = gray;
			buf[sx2] = gray;
		}
	}

	//subsampling (first round)
	//h * w: number of pixels; 4 * h * w: number of color values (real number each value)
	/* let h2 = Math.ceil(factorInv * sh), w2 = Math.ceil(factorInv * sw);
	let buf1 = scalePixels[0].dataFloat, buf2 = new Float32Array(4 * h2 * w2);
	let i = scalePixels.push({h: h2, w: w2, dataFloat: buf2});
	for(let sy = 0, sy2, y2, sx, sx2, x2; sy < sh; sy++) {
		sy2 = sw * sy;
		y2 = w2 * ((sy * factorInv)|0);
		for(sx = 0; sx < sw; sx++) {
			x2 = 4 * (y2 + (sx * factorInv)|0);
			sx2 = 4 * (sy2 + sx); */
			/* buf2[x2++] += buf1[sx2++];
			buf2[x2++] += buf1[sx2++];
			buf2[x2++] += buf1[sx2++]; */
			/* let gray = (buf1[sx2++] + buf1[sx2++] + buf1[sx2++]) / 3;
			buf2[x2++] += gray;
			buf2[x2++] += gray;
			buf2[x2++] += gray;
			buf2[x2] += buf1[sx2];
		}
	}
	for(let sy = 0; sy < 4 * h2 * w2; sy++)
		buf2[sy] *= factorInv2; */

	//upscaleImage();
}
function upscaleImage() {
	ch = factor * sh;
	cw = factor * sw;
	txtOutputResH.value = ch;
	txtOutputResW.value = cw;
	cnvOutput.height = ch;
	cnvOutput.width = cw;
	//imageScaleUpdate(cbxOutputScale, cnvOutput);
	//canvasSizeUpdate();
	canvasSizeChanged();
	if(!scalePixels[0]) return;

	let t = Date.now(); //to do: use performance (more accurate)
	//let h2 = Math.ceil(factorInv * sh), w2 = Math.ceil(factorInv * sw);
	let h2 = sh, w2 = sw;
	//Anisotropic upscaling (vertically first)
	let stretchedArr = new Float32Array(4 * w2 * ch);
	let buf1 = stretchedArr, buf2 = scalePixels[0].dataFloat;
	for(let y = 0, yRow, syRow, x, x2, sx2; y < h2; y++) {
		yRow = w2 * y;
		syRow = w2 * y * factor;
		for(x = 0; x < w2; x++) {
			x2 = 4 * (yRow + x);
			sx2 = 4 * (syRow + x);

			//Interpolation
			//to do: Currently grayscale/monochromatic.
			let y2a = defV, y2b = defV, y2a2 = defV, y2b2 = defV, y2m;
			let rowPitch = 4 * w2;
			if(y > 1) y2a2 = buf2[x2 - 2 * rowPitch];
			if(y > 0) y2a = buf2[x2 - rowPitch];
			y2m = buf2[x2];
			if(y < h2 - 1) y2b = buf2[x2 + rowPitch];
			if(y < h2 - 2) y2b2 = buf2[x2 + 2 * rowPitch];
			//let vdy = 0.125 * (y2b - y2a);
			//let vdy = 0.25 * ((y2b - y2a) - 0.25 * (y2a - y2a2) - 0.25 * (y2b2 - y2b));
			let dy = y2b - y2a, dya = y2m - y2a2, dyb = y2b2 - y2m;
			//let vdy = 0.25 * (dy - 0.25 * dya - 0.25 * dyb);

			dy = Math.abs(dy) ** distInv * Math.sign(dy), dya = Math.abs(dya) ** distInv * Math.sign(dya), dyb = Math.abs(dyb) ** distInv * Math.sign(dyb);
			dy = dy + dBlur * (dya + dyb);
			dy = Math.abs(dy) ** dist * Math.sign(dy);
			let vdy = deltaScale * dy;

			buf1[sx2] += buf2[x2] - vdy;
			buf1[sx2 + 1] += buf2[x2 + 1] - vdy;
			buf1[sx2 + 2] += buf2[x2 + 2] - vdy;
			buf1[sx2 + 3] += buf2[x2 + 3] - 0;

			sx2 += 4 * w2;
			buf1[sx2] += buf2[x2] + vdy;
			buf1[sx2 + 1] += buf2[x2 + 1] + vdy;
			buf1[sx2 + 2] += buf2[x2 + 2] + vdy;
			buf1[sx2 + 3] += buf2[x2 + 3] + 0;
		}
	}

	//scalePixels[0].dataFloat = new Float32Array(scalePixels[0].dataFloat.length);
	//scalePixels[1].dataFloat = new Float32Array(4 * ch * cw);
	//scalePixels.push({h: ch, w: cw, dataFloat: new Float32Array(4 * ch * cw)});
	if(!scalePixels[1]) scalePixels.push({});
	scalePixels[1] = {h: ch, w: cw, dataFloat: new Float32Array(4 * ch * cw)};
	buf1 = scalePixels[1].dataFloat; buf2 = stretchedArr;
	/*for(let sy = 0, yRow, y2, sx, x2, sx2; sy < ch; sy++) { //Loop over the expanded image.
		yRow = cw * sy;
		y2 = w2 * ((sy * factorInv)|0);
		for(sx = 0; sx < cw; sx++) {
			x2 = 4 * (y2 + (sx * factorInv)|0);
			sx2 = 4 * (yRow + sx);
			buf1[sx2] = buf2[x2];
			buf1[sx2 + 1] = buf2[x2 + 1];
			buf1[sx2 + 2] = buf2[x2 + 2];
			buf1[sx2 + 3] = buf2[x2 + 3];
		}
	}*/
	for(let y = 0, yRow, syRow, x, x2, sx2; y < ch; y++) {
		yRow = w2 * y;
		syRow = cw * y;
		for(x = 0; x < w2; x++) {
			x2 = 4 * (yRow + x);
			sx2 = 4 * (syRow + x * factor);

			//Interpolation
			//to do: Currently grayscale/monochromatic.
			let x2a = defV, x2b = defV, x2a2 = defV, x2b2 = defV, x2m;
			if(x > 0) x2a = buf2[x2 - 4];
			if(x > 1) x2a2 = buf2[x2 - 4 * 2];
			x2m = buf2[x2];
			if(x < w2 - 1) x2b = buf2[x2 + 4];
			if(x < w2 - 2) x2b2 = buf2[x2 + 4 * 2];
			//let vdx = 0.125 * (x2b - x2a);
			//let vdx = 0.25 * ((x2b - x2a) - 0.25 * (x2a - x2a2) - 0.25 * (x2b2 - x2b));
			let dx = x2b - x2a, dxa = x2m - x2a2, dxb = x2b2 - x2m;
			dx = Math.abs(dx) ** distInv * Math.sign(dx), dxa = Math.abs(dxa) ** distInv * Math.sign(dxa), dxb = Math.abs(dxb) ** distInv * Math.sign(dxb);
			dx = dx + dBlur * (dxa + dxb);
			dx = Math.abs(dx) ** dist * Math.sign(dx);
			let vdx = deltaScale * dx;

			//sx3 = sx2 + 4 * cw * dy;
			buf1[sx2] += buf2[x2] - vdx;
			buf1[sx2 + 1] += buf2[x2 + 1] - vdx;
			buf1[sx2 + 2] += buf2[x2 + 2] - vdx;
			buf1[sx2 + 3] += buf2[x2 + 3] - 0;

			buf1[sx2 + 4] += buf2[x2] + vdx;
			buf1[sx2 + 5] += buf2[x2 + 1] + vdx;
			buf1[sx2 + 6] += buf2[x2 + 2] + vdx;
			buf1[sx2 + 7] += buf2[x2 + 3] + 0;
		}
	}

	//imageData = outputC2d.createImageData(cw, ch);
	let imageArray = Uint8ClampedArray.from(scalePixels[1].dataFloat, x => x * 255);
	t = Date.now() - t;
	//console.debug(`Upsampling done in ${t.toString()} ms.`);
	//renderTime = t;
	outFrameRenderT.innerText = t.toString();
	//var imageArray = new Uint8ClampedArray(4 * ch * cw);
	imageData = new ImageData(imageArray, cw, ch);
	outputC2d.putImageData(imageData, 0, 0);
}

function inImageChange(event) {
	const fileList = this.files;
	if(fileList.length < 1) return;
	const file = fileList[0];
	imgSource.src = URL.createObjectURL(file);
	imgSource.addEventListener("load", (event) => {
		URL.revokeObjectURL(this.src);
	}, {once: true});
}
function loadURL(event) {
	//imgSource.src = "";
	//imgSource.crossOrigin = (chkSourceCORS.checked ? "anonymous" : null);
	imgSource.src = txtImgURL.value;
}
function cbxURLPresetChanged(event) {
	let elem = event.target;
	if(!elem) return;
	txtImgURL.value = elem.value;
	/* if(!elem.dataset) return;
	let id = elem.dataset["remote"];
	if(!id) return;
	chkSourceCORS.checked = id.toLowerCase() == "true"; */
}
function chkShrinkChanged(event) {
	let elem = event.target;
	if(!elem || !elem.dataset) return;
	let id = elem.dataset["image"];
	if(!id) return;
	let image = document.getElementById(id);
	let parent = image.parentElement;
	if(elem.checked) {
		image.classList.add("shrink");
		//parent.style.;
	} else {
		image.classList.remove("shrink");
	}
}
function txtParamsChanged(event) {
	dist = txtDistortion.value;
	distInv = 1 / dist;
	dBlur = txtDBlur.value;
	deltaScale = txtDeltaScale.value;
}
function txtDistortionChanged(event) {
	let elem = event.target;
	if(!elem) return false;
	//let val = elem.valueAsNumber;
	let val = parseFloat(elem.value);
	if(isNaN(val)) {
		val = 1;
		elem.classList.add("invalid");
		elem.setCustomValidity("Input not recognized as a real number.");
	} else {
		elem.classList.remove("invalid");
		elem.setCustomValidity("");
	}
	let magnitude = Math.round(Math.log2(Math.abs(val))), step = 0.25 * 2 ** magnitude;
	elem.step = step;
	//if(elem == txtDistortion) {elem.min = val - 2 * step;}
	//elem.min = val - 2 * Math.sign(val) * step;
	//elem.reportValidity();
}

function pageReady() {
	let evt = new Event("change");
	chkSourceShrink.dispatchEvent(evt);
	chkOutputShrink.dispatchEvent(evt);
	txtParamsChanged();

	if(cnvOutput.getContext) {
		outputC2d = cnvOutput.getContext('2d');
		//outputC2d = cnvOutput.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
		//outputC2d = cnvOutput.getContext('2d', {alpha: false});
		//outputC2d.globalAlpha = 1;
		//outputC2d.imageSmoothingEnabled = false;

		ch = cnvOutput.height;
		cw = cnvOutput.width;

		//imageScaleUpdate(cbxSourceScale, imgSource);
		imageScaleUpdate(cbxOutputScale, cnvOutput);
	} else {
		/* btnViewUpdate.disabled = true;
		btnStartUpdating.disabled = true; */
		cbxOutputScale.disabled = true;
	}
}
function pageLoaded() {
	for(let s of document.querySelectorAll('[id]'))
		window[s.id] = s;

	//cbxOutputScale.innerHTML = cbxSourceScale.innerHTML; //clone list.
	inImage.addEventListener("change", inImageChange);
	btnImgLoad.addEventListener("click", loadURL);
	cbxURLPreset1.addEventListener("change", cbxURLPresetChanged);
	cbxURLPreset2.addEventListener("change", cbxURLPresetChanged);
	//chkSourceCORS.addEventListener("change", (event) => {imgSource.crossOrigin = (chkSourceCORS.checked ? "anonymous" : null)});
	imgSource.addEventListener("load", imgSourceLoaded);
	cbxSourceScale.addEventListener("change", cbxScaleChanged);
	chkSourceShrink.addEventListener("change", chkShrinkChanged);

	txtDistortion.addEventListener("input", txtParamsChanged);
	txtDistortion.addEventListener("input", txtDistortionChanged);
	txtDBlur.addEventListener("input", txtParamsChanged);
	txtDeltaScale.addEventListener("input", txtParamsChanged);
	cbxOutputScale.addEventListener("change", cbxScaleChanged);
	chkOutputShrink.addEventListener("change", chkShrinkChanged);

	btnResample.addEventListener("click", upscaleImage);
}

//window.addEventListener("DOMContentLoaded", pageLoaded);
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
