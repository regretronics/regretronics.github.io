"use strict";

function drawFrame(ctx, cw, ch, colorSpace, bgIntensity, spotIntensity, spotSize) {
	if(!ctx || !cw || !ch) return;

	//ctx.fillStyle = "color(srgb-linear 2 2 2)";
	const colorStr = intensity => (`color(${colorSpace} ${intensity} ${intensity} ${intensity})`);

	//background
	const bgColor = colorStr(bgIntensity);
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, cw, ch);
	
	//circle
	ctx.beginPath();
	const spotColor = colorStr(spotIntensity);
	ctx.fillStyle = spotColor;
	const spotSizeAbs = spotSize * Math.max(cw, ch);
	ctx.ellipse(0.5 * cw - 0.5, 0.5 * ch - 0.5, spotSizeAbs, spotSizeAbs, 0, 0, 2 * Math.PI);
	ctx.fill();

	//blocky gradient
	const stepCount = 256;
	for(let i = 0; i < stepCount; i++) {
		const barIntensity = i / (stepCount - 1);
		ctx.fillStyle = colorStr(barIntensity);
		//ctx.fillRect(cw * i / stepCount, 0, cw / stepCount, 0.0625 * ch);
		ctx.fillRect(
			Math.round(cw * i / stepCount), 0,
			Math.round(cw * (i + 1) / stepCount) - Math.round(cw * i / stepCount), 0.0625 * ch);
	}

	//smooth gradient
	/* const gradient = ctx.createLinearGradient(0, 0, cw, 0);
	gradient.addColorStop(0, colorStr(0));
	gradient.addColorStop(1, colorStr(1));

	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0.0625 * ch, cw, 0.0625 * ch); */
	for(let i = 0; i < cw; i++) {
		const barIntensity = i / (cw - 1);
		ctx.fillStyle = colorStr(barIntensity);
		ctx.fillRect(i, 0.0625 * ch, 1, 0.0625 * ch);
	}
}
