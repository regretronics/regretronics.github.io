"use strict";

const visSliceCount = 48;
const svgNS = "http://www.w3.org/2000/svg";

function drawNote(group, sourceNode) {
	if(!group || !sourceNode) return false;
	const noteVisWidth = 1 / 16; //bandwidth in octaves; hand-tuned, partially arbitrary scale

	let freq, isTone = Boolean(sourceNode.frequency), isFiltered = Boolean(sourceNode.fltBandPass);
	if(isTone)
		freq = sourceNode.frequency.value * 2 ** (sourceNode.detune.value / 1200); //1200 cents = 1 octave (log2)
	else
		if(isFiltered) freq = sourceNode.fltBandPass.frequency?.value;
	if((isTone || isFiltered) && !freq) return false;

	//to do: alternative blend modes such as lighten or hue?
	const noteShape = document.createElementNS(svgNS, "rect");
	//the attributes below are constant, so I could have replaced them with CSS;
	//however, visualization would become impossible in the unlikely case that style sheets are disabled
	noteShape.setAttributeNS(null, "height", "1");
	noteShape.setAttributeNS(null, "y", "0");

	if(isTone || isFiltered) {
		let width = (isTone ? noteVisWidth : 8 * sourceNode.fltBandPass.Q.value ** (-1 / 3)); //hand-tuned parameters
		if(isTone && sourceNode.modGainVibrato) {
			const vibratoGain = sourceNode.modGainVibrato.gain.value / 1200;
			if(sourceNode.oscVibrato) //question: precisely estimate vibrato oscillation? (currently yes)
				freq *= 2 ** (vibratoGain * Math.sin(2 * Math.PI * (sourceNode.context.currentTime - sourceNode.oscVibrato.tStart) * sourceNode.oscVibrato.frequency.value)); //yes
			else
				width = Math.max(wid, 4 * vibratoGain); //no
		}
		noteShape.classList.add("tapered");
		noteShape.setAttributeNS(null, "width", width.toString());
		noteShape.setAttributeNS(null, "x", (Math.log2(Math.abs(freq)) - 0.5 * width).toString());
	} else {
		noteShape.setAttributeNS(null, "x", "0");
		//noteShape.setAttributeNS(null, "x", Math.log2(1).toString());
		//noteShape.setAttributeNS(null, "width", "1");
		noteShape.setAttributeNS(null, "width", Math.log2(0.5 * sourceNode.context.sampleRate).toString());
	}

	let vol = (isTone ? 1 : 
		(isFiltered ? 0.125 * sourceNode.fltBandPass.Q.value ** (-1 / 3) : 0.5)); //hand-tuned parameters (to do: check for unfiltered noise)
	if(sourceNode.modGainDecay) vol *= sourceNode.modGainDecay.gain?.value ?? 1;
	if(sourceNode.modGainAttack) vol *= sourceNode.modGainAttack.gain?.value ?? 1;
	if(sourceNode.modGainRelease) vol *= sourceNode.modGainRelease.gain?.value ?? 1;
	noteShape.setAttributeNS(null, "opacity", /* Math.sqrt */(Math.abs(vol)).toString());

	group.appendChild(noteShape);
	//group.append(noteShape);
	return noteShape;
}

var visT;
function visualizerUpdate(clip, tNow) {
	if(!window.imgVisualizer) return false;
	const nowY = visSliceCount - 1; //to do: !change scale reference

	//scroll
	const slices = imgVisualizer.getElementsByClassName("vis-slice"), lastSlice = slices.length - 1;
	if(lastSlice >= 0) { //update slice duration to the correct amount once
		const slice = slices[lastSlice], t1 = parseFloat(slice.getAttribute("data-t"));
		slice.setAttributeNS(null, "data-dt", (tNow - t1).toString());
	}
	//to do: adjust visArea transform instead of moving every row
	for(let i = lastSlice; i >= 0; i--) {
		const slice = slices[i];
		const absY = parseFloat(slice.getAttribute("data-t")) / audioTimerInterval; //dataset doesn't work here, somehow (to do: re-check)
		//const newY = absY + (nowY - visT) /* * audioTimerInterval */;
		const newY = absY + (nowY - tNow / audioTimerInterval);
		if(newY <= -1) {
		//if(newY <= -audioTimerInterval) {
			slice.remove(); //it's easier to delete when we use groups
			continue;
		}
		const dy = parseFloat(slice.getAttribute("data-dt")) / audioTimerInterval;
		//newY /= visSliceCount;
		slice.setAttributeNS(null, "transform", `translate(0 ${newY}) scale(1 ${dy})`);
	}

	//new row of spectrum
	//to do: consider a node-based polyline
	//to do: consider SVG animation: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animateTransform , https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/accumulate
	//https://developer.mozilla.org/en-US/docs/Web/API/SVGSVGElement/pauseAnimations
	//https://developer.mozilla.org/en-US/docs/Web/API/SVGSVGElement/unpauseAnimations
	const slice = document.createElementNS(svgNS, "g");
	slice.setAttributeNS(null, "class", "vis-slice");
	/* slice.setAttributeNS(null, "data-t", (visT * audioTimerInterval).toString()); */
	slice.setAttributeNS(null, "data-t", tNow.toString());
	slice.setAttributeNS(null, "data-dt", audioTimerInterval.toString());
	//slice.setAttributeNS(null, "transform", `translate(0 ${nowY / visSliceCount})`);
	slice.setAttributeNS(null, "transform", `translate(0 ${nowY})`);
	//slice.setAttributeNS(null, "transform", `translate(0 ${nowY}) scale(1 ${1})`);
	window.visArea?.appendChild?.(slice); //to do: some operations should actually fail and break the flow; maybe I'm using too many checks all the time
	for(const node of clip.generators)
		try { //visualizer note errors shouldn't block the rest of the execution flow
			drawNote(slice, node);
			//drawNote(slice, node)?.setAttributeNS(null, "height", audioTimerInterval.toString());
		} catch(error) {
			console.warn(error);
		}
	visT++;
	return true;
}

function updateVisAreaTransform() {
	if(!window.imgVisualizer) return false;

	freqMin = NaNToDefault(parseNumber(window.txtFreqRangeMin?.value), prefsDefault.genParams.freqRangeMin);
	freqMax = NaNToDefault(parseNumber(window.txtFreqRangeMax?.value), prefsDefault.genParams.freqRangeMax);
	//if(window.visArea) visArea.setAttributeNS(null, "transform", `translate()`);
	if(!window.visArea?.transform?.baseVal) return false;

	const newScale = imgVisualizer.createSVGTransform();
	newScale.setScale(1 / Math.log2(freqMax / freqMin), 1 / visSliceCount);
	//newScale.setScale(1 / Math.log2(freqMax / freqMin), 1 / (visSliceCount * audioTimerInterval));
	visArea.transform.baseVal.initialize(newScale);
	const newTranslate = imgVisualizer.createSVGTransform();
	newTranslate.setTranslate(- Math.log2(freqMin), 0);
	visArea.transform.baseVal.appendItem(newTranslate);
	return true;
}
