"use strict";
//idea: have a "reload script" button?

var sourceC2d, outputC2d;
//detail: I'm putting height before width, because x is subordinate to y in raster scan.
var sh, sw, imgSourceData;
var ch, cw, imgData;
var transformPerf = {};
var scalePixels = [];

var sinc_size, sinc_filter1Float = null;
const sinc_r = 3;

//note: as of 2022-09 browsers only support 8 bits per channel in raster/bitmap images; deep color and hdr pixel formats are not yet available for script manipulation.

function imgSourceLoaded(event) {
	imageScaleUpdate(selSourceScale.selectedOptions[0].label, imgSource);
	sh = event.target.naturalHeight;
	sw = event.target.naturalWidth;

	outSourceRes.textContent = `${sw}x${sh}`;
	window.setTimeout(compEncode, 100, event.target);
}

const factor = 4, factorInv = 1 / factor;
function compEncode(image) {
	//to do: ...OffscreenCanvas (not supported in Firefox as of 2022-09)
	//const offscreen = new OffscreenCanvas(sw, sh);
	if(!cnvSource || !cnvSource.getContext) return;
	cnvSource.height = sh;
	cnvSource.width = sw;

	//sourceC2d = cnvSource.getContext('2d');
	//sourceC2d = cnvSource.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
	sourceC2d = cnvSource.getContext('2d', {alpha: false, willReadFrequently: true});
	//sourceC2d.globalAlpha = 1;
	//sourceC2d.imageSmoothingEnabled = false;

	sourceC2d.drawImage(image, 0, 0);
	imgSourceData = sourceC2d.getImageData(0, 0, sw, sh);

	scalePixels = [];
	const b8ToFloatScale = 1 / 255;
	scalePixels.push({
		h: sh, 
		w: sw, 
		dataFloat: Float32Array.from(imgSourceData.data, x => x * b8ToFloatScale)
	}); //question: change push() for unshift() (reverses the array order)?
	//question: subtract 0.5 from color values? (currently no)

	const tNow = performance.now();
	let encObj;
	switch(selTransformType.value) {
		case "downsampling-sinc":
		case "blocksBasic":
			const h2 = Math.ceil(factorInv * sh), w2 = Math.ceil(factorInv * sw);
			encObj = encodeFrame_decimate(scalePixels[0], h2, w2, factorInv);
			if(selTransformType.value == "blocksBasic")
				encObj = encodeFrame_difference(scalePixels[0], encObj, factorInv);
			scalePixels.push(encObj);
			break;
		case "posterization":
			scalePixels.push(encodeFrame_posterize(scalePixels[0], 0.25));
			break;
		case "luma posterization":
			encObj = encodeFrame_luma(scalePixels[0], 0.0);
			encObj = encodeFrame_chromaPosterize(encObj, 0.0625, 0.0625);
			scalePixels.push(encObj);
			break;
		case "luma downsampling":
			encObj = encodeFrame_luma(scalePixels[0], 0.0);
			encObj = encodeFrame_toPlanes4(encObj);
			const c1sub = 1 / 2, c2sub = 1 / 4;
			encObj = [
				encObj[0],
				encodePlane_decimate(encObj[1], Math.ceil(sh * c1sub), Math.ceil(sw * c1sub), c1sub),
				encodePlane_decimate(encObj[2], Math.ceil(sh * c2sub), Math.ceil(sw * c2sub), c2sub),
				encObj[3]
			];
			scalePixels.push(encObj);
			break;
		/* default:
			transformPerf = {encode: 0, decode: 0};
			outMediaEncodeT.innerText = transformPerf.encode.toFixed(2);
			outMediaDecodeT.innerText = transformPerf.decode.toFixed(2);
			return; */
	}
	transformPerf.encode = performance.now() - tNow;

	compDecode(sh, sw, cnvOutput, outputC2d);
	outMediaEncodeT.innerText = transformPerf.encode.toFixed(2);
	outMediaDecodeT.innerText = transformPerf.decode.toFixed(2);
}

function compDecode(sh, sw, cnvOutput, outputC2d) {
	canvasSizeUpdate(cnvOutput, sh, sw);

	const tNow = performance.now();
	switch(selTransformType.value) {
		case "downsampling-sinc":
			scalePixels[0] = decodeFrame_filterSinc(scalePixels[1], factor);
			break;
		case "blocksBasic":
			scalePixels[0] = decodeFrame_blocksBasic(scalePixels[1], factor);
			break;
		case "posterization":
			scalePixels[0] = scalePixels[1];
			break;
		case "luma posterization":
			scalePixels[0] = decodeFrame_luma(scalePixels[1], 0.0);
			break;
		case "luma downsampling":
			const encObj = decodePlanes4_toFrame(scalePixels[1], sh, sw);
			scalePixels[0] = decodeFrame_luma(encObj, 0.0);
			break;
		/* default:
			return; */
	}
	transformPerf.decode = performance.now() - tNow;

	//imgData = outputC2d.createImageData(cw, ch);
	const imgArray = Uint8ClampedArray.from(scalePixels[0].dataFloat, x => x * 255);
	//var imgArray = new Uint8ClampedArray(4 * ch * cw);
	imgData = new ImageData(imgArray, scalePixels[0].w, scalePixels[0].h);
	outputC2d.putImageData(imgData, 0, 0);
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
	const elem = event.target;
	if(!elem) return;
	txtImgURL.value = elem.value;
	/* if(!elem.dataset) return;
	const id = elem.dataset["remote"];
	if(!id) return;
	chkSourceCORS.checked = id.toLowerCase() == "true"; */
}
function chkShrinkChanged(event) {
	const elem = event.target;
	if(!elem) return;
	//const image = imgSource;
	//const parent = image.parentElement;
	if(elem.checked) {
		imgSource.classList.add("shrink");
		cnvOutput.classList.add("shrink");
		//parent.style.;
	} else {
		imgSource.classList.remove("shrink");
		cnvOutput.classList.remove("shrink");
	}
}

function pageReady(event) {
	if(cnvOutput.getContext) {
		outputC2d = cnvOutput.getContext('2d');
		//outputC2d = cnvOutput.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
		//outputC2d = cnvOutput.getContext('2d', {alpha: false});
		//outputC2d.globalAlpha = 1;
		//outputC2d.imageSmoothingEnabled = false;

		ch = cnvOutput.height;
		cw = cnvOutput.width;

		imageScaleUpdate(selSourceScale.selectedOptions[0].label, imgSource);
		imageScaleUpdate(selSourceScale.selectedOptions[0].label, cnvOutput);
	} else {
		btnTransform.disabled = true;
	}

	//precomputation
	sinc_size = factor * (1 + 2 * sinc_r);
	const dx = -0.5 * (sinc_size - 1);
	sinc_filter1Float = new Float32Array(sinc_size);
	const normalFactor = -(0.25 ** 2);
	for(let x = 0; x < sinc_size; x++) {
		const x2 = (x + dx) * factorInv * Math.PI;
		//sinc_filter1Float[x] = Math.sin(x2) / x2; //rectangular window
		sinc_filter1Float[x] = Math.exp(normalFactor * x2 * x2) * Math.sin(x2) / x2; //gaussian window
	}
}
function btnTransformClick(event) {
	compEncode(imgSource);
}
function pageLoaded(event) {
	for(const s of document.querySelectorAll('[id]'))
		window[s.id] = s;

	inImage.addEventListener("change", inImageChange);
	btnImgLoad.addEventListener("click", loadURL);
	cbxURLPreset1.addEventListener("change", cbxURLPresetChanged);
	cbxURLPreset2.addEventListener("change", cbxURLPresetChanged);
	//chkSourceCORS.addEventListener("change", (event) => {imgSource.crossOrigin = (chkSourceCORS.checked ? "anonymous" : null)});
	imgSource.addEventListener("load", imgSourceLoaded);
	selSourceScale.addEventListener("change", selScaleChanged);
	chkSourceShrink.addEventListener("change", chkShrinkChanged);

	btnTransform.addEventListener("click", btnTransformClick);

	const evt = new Event("change");
	chkSourceShrink.dispatchEvent(evt);
}

if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
