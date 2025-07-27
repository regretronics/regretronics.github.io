"use strict";

function drawFrame(ctx, cw, ch, bgColor, spotColor, spotSize) {
	if(!ctx || !cw || !ch) return;

	//ctx.fillStyle = "color(rec2020 1 1 1)";
	//ctx.fillStyle = "color(rec2020 2 2 2)";
	//ctx.fillStyle = "color(srgb-linear 1 1 1)";
	//ctx.fillStyle = "color(srgb-linear 2 2 2)";
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, cw, ch);

	ctx.beginPath();
	ctx.fillStyle = spotColor;
	let spotSizeAbs = spotSize * Math.max(cw, ch);
	ctx.ellipse(0.5 * cw - 0.5, 0.5 * ch - 0.5, spotSizeAbs, spotSizeAbs, 0, 0, 2 * Math.PI);
	ctx.fill();
}
