"use strict";
function frameRenderSimple(imgData) {
	var data = imgData.data, i;
	//note: the alpha channel must be also set for the result to be visible.

	//fill the whole buffer with the same color.
	var l = data.length;
	//simplifying the loop condition is also a loop optimization.
	for(i = 0; i < l; i += 4) {
		data[i] = 191;
		data[i + 1] = 191;
		data[i + 2] = 191;
		//data[i + 3] = 128;
	}

	//var bufh = imgData.height, bufw = imgData.width;
	//rectangular fill (opaque)
	/*for(let y = 0; y < 256; y++) {
		for(let x = 64; x < 64 + 256; x++) {
			i = 4 * (bufw * y + x);
			data[i] = 255;
			data[i + 1] = 128;
			data[i + 2] = 0;
			data[i + 3] = 255;
		}
	}*/
}

function frameRenderPolar(imgData) {
	//the x|0 pattern is (hopefully) an asm.js-inspired optimization for marking an expression as integer. this imposes a Math.trunc(x) (not floor) and conversion to a 32-bit signed integer.
	var data = imgData.data, i;
	var bufh = imgData.height|0, bufw = imgData.width|0;

	//polar-based drawing
	i = 0;
	var color = new Array(3);
	//Object.preventExtensions(color); //these two break the code.
	//Object.seal(color);
	//apparently, let is marginally faster than var
	//let requires ECMAScript 6/2015.
	//optimization: precompute things outside the loops.
	for(let y = 0, x, y2 = 0.5 - 0.5 * bufh, y2sqr, x20 = 0.5 - 0.5 * bufw, x2, r, theta, r2, theta2; y < bufh; y++, y2++) {
		//y2 = y + 0.5 - 0.5 * bufh;
		y2sqr = y2 * y2;
		x2 = x20;
		for(x = 0; x < bufw; x++, x2++) {
			//x2 = x + 0.5 - 0.5 * bufw;

			//optimization: scale only the radius, not y2 and x2
			/*var r = 2 / bufh * Math.sqrt(x2 * x2 + y2 * y2);
			var r2 = r - Math.floor(r);
			var r3 = (r == 0) ? 0 : (Math.log(r) / Math.LN2);
			//striping
			r3 = Math.floor(r3);
			r3 = r3 - 2 * Math.floor(0.5 * r3);

			var theta = Math.atan2(y2, x2) / (2 * Math.PI) + 0.5;
			theta = Math.floor(12 * theta);

			color[0] = 255 * r2;
			color[1] = 191 * ((r3 + theta) % 2);
			color[2] = 64 * r;*/
			
			//Math.hypot is terribly slow. Math.hypot requires ECMAScript 6/2015.
			//r = 2 / bufh * Math.hypot(x2, y2);
			//r = 2 / bufh * Math.sqrt(x2 * x2 + y2 * y2);
			r = 2 / bufh * Math.sqrt(x2 * x2 + y2sqr);
			//r = (r == 0) ? 0 : (Math.log(r) / Math.LN2);
			//r = (r == 0) ? 0 : (Math.log(r) * Math.LOG2E);
			//Math.log2 requires ECMAScript 6/2015.
			//r = (r == 0) ? 0 : Math.log2(r);
			//r = (r == 0) ? 0 : (Math.log2(r) + 0.25 * frameCount);
			r = (r == 0) ? 0 : (log2_LUT(r) + 0.25 * frameCount);
			//to do: there may be a way to avoid the atan2 (but maybe requiring sin and cos).
			//theta = 12 * (Math.atan2(y2, x2) / (2 * Math.PI) + 0.5) /*+ 0.25 * frameCount*/;
			theta = 12 * (atan2_LUT(y2, x2) / (2 * Math.PI) + 0.5) /*+ 0.25 * frameCount*/;
			r2 = r + theta; theta2 = - r + theta;
			//destructuring assignment turns out to be slow. it requires ECMAScript 6/2015.
			//[r2, theta2] = [r + theta, - r + theta];
			/*r2 = r2 - Math.floor(r2);
			theta2 = theta2 - Math.floor(theta2);*/
			r2 = Math.floor(r2)|0;
			theta2 = Math.floor(theta2)|0;
			//striping
			r2 = (r2 - 2 * Math.floor(0.5 * r2))|0;
			theta2 = (theta2 - 2 * Math.floor(0.5 * theta2))|0;
			
			//to do: try Uint8Array, Uint8ClampedArray or ArrayBuffer?
			color = [(255 * r2)|0, (64 + 128 * ((r2 + theta2) % 2))|0, (255 * theta2)|0];
			/*color[0] = 128 * r2;
			color[1] = 255 * ((r2 + theta2) % 2);
			color[2] = 128 * theta2;*/
			/*data[i] = 64 + 128 * r2;
			data[i + 1] = 255 * ((r2 + theta2) % 2);
			data[i + 2] = 64 + 128 * theta2;*/
			
			//color write to pixel
			//i = 4 * (bufw * y + x);
			data[i] = color[0];
			data[i + 1] = color[1];
			data[i + 2] = color[2];
			//data[i + 3] = 255;
			i += 4;
		}
	}
}

//to do: multithreaded rendering

//--
//virtual vectorial world context
//to do: review for optimization.
var worldRes = [16, 16, 16];
//to do: worldScan needs a lower-level array type.
//to do: expand voxel format to color + alpha, 3 primaries.
var worldScan = new Array(worldRes[0] * worldRes[1] * worldRes[2] * 6);
var emptyVoxel = [0.0, 0.5, 1.0, 0.5, 0.5, 0.5];

function worldVoxelsInit() {
	for(let i = 0; i < 6 * worldRes[0] * worldRes[1] * worldRes[2]; i++) {
		worldScan[i] = Math.random();
	}
	
	/*for(let z = 0; z < worldRes[0]; z++) {
		for(let y = 0; y < worldRes[1]; y++) {
			for(let x = 0; x < worldRes[2]; x++) {
				//
			}
		}
	}*/
}

//--
//virtual vectorial client context
//under construction, untested.
//var clientPos = new Array(3), clientRot = new Array(9);
var clientPos = [8.5, 8.5, 8.5];
var clientSpcTransf = [
 1, 0, 0,
 0, 1, 0,
 0, 0, 1];
var clientFoVH = 1;
var rayDirs, rayDirsSign;

function clientUpdateSpcTransf() {
	//to do
}

function viewRayDirsCompute_Rectilinear(ch, cw) {
	if(rayDirs == undefined) {rayDirs = new Array();}
	rayDirs.length = ch * cw * 4;
	if(rayDirsSign == undefined) {rayDirsSign = new Array();}
	rayDirsSign.length = ch * cw * 3;
	
	for(let rayDirs0 = new Array(3), y = 0, x, yf, xf, pRayDirs = 0, pRayDirsSign = 0;
	 y < ch;
	 y++) {
		yf = clientFoVH * (2.0 * (y + 0.5) / ch - 1.0);
		rayDirs0[0] = clientSpcTransf[6] * 1.0 + clientSpcTransf[3] * yf;
		rayDirs0[1] = clientSpcTransf[7] * 1.0 + clientSpcTransf[4] * yf;
		rayDirs0[2] = clientSpcTransf[8] * 1.0 + clientSpcTransf[5] * yf;
		
		for(x = 0; x < cw; x++) {
			xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) / ch;

			rayDirs[pRayDirs + 0] = rayDirs0[0] + clientSpcTransf[0] * xf;
			rayDirsSign[pRayDirsSign + 0] = Math.sign(rayDirs[pRayDirs + 0]);
			rayDirs[pRayDirs + 1] = rayDirs0[1] + clientSpcTransf[1] * xf;
			rayDirsSign[pRayDirsSign + 1] = Math.sign(rayDirs[pRayDirs + 1]);
			rayDirs[pRayDirs + 2] = rayDirs0[2] + clientSpcTransf[2] * xf;
			rayDirsSign[pRayDirsSign + 2] = Math.sign(rayDirs[pRayDirs + 2]);
			rayDirs[pRayDirs + 3] = Math.sqrt(rayDirs[pRayDirs + 0] * rayDirs[pRayDirs + 0] + rayDirs[pRayDirs + 1] * rayDirs[pRayDirs + 1] + rayDirs[pRayDirs + 2] * rayDirs[pRayDirs + 2]);
			
			pRayDirs += 4;
			pRayDirsSign += 3;
		}
	}
}

var rayCrossingPoints, rayDead, rowDead, rayPosColor, accumBuffer;
var frameMaxLayers = 6;
const rayTranspThreshold = 0.01;

function frameRenderRaycasting(imgData) {
	var data = imgData.data, i;
	var bufh = imgData.height|0, bufw = imgData.width|0;
	
	if(rayCrossingPoints == undefined) {rayCrossingPoints = new Array();}
	rayCrossingPoints.length = bufh * bufw * 3;
	if(rayDead == undefined) {rayDead = new Array();}
	rayDead.length = bufh * bufw;
	if(rowDead == undefined) {rowDead = new Array();}
	rowDead.length = bufh;
	if(rayPosColor == undefined) {rayPosColor = new Array();} //?
	rayPosColor.length = bufh * bufw * 3 * 2;
	if(accumBuffer == undefined) {accumBuffer = new Array();}
	accumBuffer.length = bufh * bufw * 3 * 2;
	
	//more initialization
	let pRayCrossingPoints = 0, pAccumBuffer = 0;
	for(let y = 0, x; y < bufh; y++) {
		 for(x = 0; x < bufw; x++) {
			rayCrossingPoints[pRayCrossingPoints] = clientPos[0];
			rayCrossingPoints[pRayCrossingPoints + 1] = clientPos[1];
			rayCrossingPoints[pRayCrossingPoints + 2] = clientPos[2];
			pRayCrossingPoints += 3;

			//color
			accumBuffer[pAccumBuffer] = 0;
			accumBuffer[pAccumBuffer + 1] = 0;
			accumBuffer[pAccumBuffer + 2] = 0;

			//alpha
			accumBuffer[pAccumBuffer + 3] = 1;
			accumBuffer[pAccumBuffer + 4] = 1;
			accumBuffer[pAccumBuffer + 5] = 1;
			pAccumBuffer += 6;
			
			rayDead[y * bufw + x] = false;
		}
		rowDead[y] = false;
	 }
	
	let pRayPosColor = 0, pRayDirs, pRayDirsSign;
	let firstCrossing, rayCoordCrossing, depth;
	let alphaNew = new Array(3), discreteCube = new Array(3), pVoxel;
	//var color = new Array(3); //?
	for(let z = 0, frameDone, y, x, pixel; z < frameMaxLayers; z++) {
		frameDone = false;
		i = 0;
		for(y = 0, pixel = 0; y < bufh; y++) {
			if(rowDead[y]) {
				//pFragmentValue += bufw;
				pixel += bufw;
				continue;
			}
			for(x = 0; x < bufw; x++, pixel++) {
				if(rayDead[pixel]) {
					//pFragmentValue++;
					continue;
				}
				
				pRayCrossingPoints = pixel * 3;
				pRayDirs = pixel * 4;
				pRayDirsSign = pixel * 3;
				
				//find the next crossing with the regular voxel grid in some axis
				//per axis, finds the t parameter (of the line formula) for the first crossing with a voxel boundary
				if(rayDirs[pRayDirs] == 0) {
					firstCrossing = 65536;
				} else {
					//todo: use abs, or even copysignf?
					//rayCoordCrossing[0] = (rayDirsSign[pRayDirsSign] * Math.floor(rayDirsSign[pRayDirsSign] * rayCrossingPoints[pRayCrossingPoints] + 1) - rayCrossingPoints[pRayCrossingPoints]) / rayDirs[pRayDirs];
					let coordProjection = rayDirsSign[pRayDirsSign] * rayCrossingPoints[pRayCrossingPoints] + 1;
					coordProjection = Math.floor(coordProjection);
					firstCrossing = (rayDirsSign[pRayDirsSign] * coordProjection - rayCrossingPoints[pRayCrossingPoints]) / rayDirs[pRayDirs];
				}

				if(rayDirs[pRayDirs + 1] != 0) {
					//rayCoordCrossing = (rayDirsSign[pRayDirsSign + 1] * Math.floor(rayDirsSign[pRayDirsSign + 1] * rayCrossingPoints[pRayCrossingPoints + 1] + 1) - rayCrossingPoints[pRayCrossingPoints + 1]) / rayDirs[pRayDirs + 1];
					let coordProjection = rayDirsSign[pRayDirsSign + 1] * rayCrossingPoints[pRayCrossingPoints + 1] + 1;
					coordProjection = Math.floor(coordProjection);
					rayCoordCrossing = (rayDirsSign[pRayDirsSign + 1] * coordProjection - rayCrossingPoints[pRayCrossingPoints + 1]) / rayDirs[pRayDirs + 1];
					if(rayCoordCrossing < firstCrossing) {
						firstCrossing = rayCoordCrossing;
					}
				}

				if(rayDirs[pRayDirs + 2] != 0) {
					//rayCoordCrossing = (rayDirsSign[pRayDirsSign + 2] * Math.floor(rayDirsSign[pRayDirsSign + 2] * rayCrossingPoints[pRayCrossingPoints + 2] + 1) - rayCrossingPoints[pRayCrossingPoints + 2]) / rayDirs[pRayDirs + 2];
					let coordProjection = rayDirsSign[pRayDirsSign + 2] * rayCrossingPoints[pRayCrossingPoints + 2] + 1;
					coordProjection = Math.floor(coordProjection);
					rayCoordCrossing = (rayDirsSign[pRayDirsSign + 2] * coordProjection - rayCrossingPoints[pRayCrossingPoints + 2]) / rayDirs[pRayDirs + 2];
					if(rayCoordCrossing < firstCrossing) {
						firstCrossing = rayCoordCrossing;
					}
				}
				
				discreteCube[0] = Math.floor(rayCrossingPoints[pRayCrossingPoints + 0] + 0.5 * firstCrossing * rayDirs[pRayDirs + 0]);
				discreteCube[1] = Math.floor(rayCrossingPoints[pRayCrossingPoints + 1] + 0.5 * firstCrossing * rayDirs[pRayDirs + 1]);
				discreteCube[2] = Math.floor(rayCrossingPoints[pRayCrossingPoints + 2] + 0.5 * firstCrossing * rayDirs[pRayDirs + 2]);

				rayCrossingPoints[pRayCrossingPoints + 0] += firstCrossing * rayDirs[pRayDirs + 0];
				rayCrossingPoints[pRayCrossingPoints + 1] += firstCrossing * rayDirs[pRayDirs + 1];
				rayCrossingPoints[pRayCrossingPoints + 2] += firstCrossing * rayDirs[pRayDirs + 2];

				//to do: maybe pre-normalize vector length for rectilinear projection as well
				//const opacityFactor = -6 / 65536;
				const opacityFactor = 64 / 256;
				//depth = opacityFactor * firstCrossing * rayDirs[pRayDirs + 3]; //rectilinear projection
				depth = opacityFactor * firstCrossing; //globular projection has equal-length rays

				let vx;
				if((discreteCube[0] >= 0) && (discreteCube[0] < worldRes[0]) &&
				 (discreteCube[1] >= 0) && (discreteCube[1] < worldRes[1]) &&
				 (discreteCube[2] >= 0) && (discreteCube[2] < worldRes[2])) {
					pVoxel = ((discreteCube[0] * worldRes[1]) + discreteCube[1]) * worldRes[2] + discreteCube[2];
					//to do: the order of coordinates was inverted between discreteCube and worldRes. try to remember why.
					vx = worldScan.slice(6 * pVoxel, 6 * pVoxel + 6);
				} else {
					//pVoxel = -1;
					vx = emptyVoxel;
				}

				//to do: exp2?
				alphaNew[0] = Math.exp(-depth * vx[3]);
				alphaNew[1] = Math.exp(-depth * vx[4]);
				alphaNew[2] = Math.exp(-depth * vx[5]);
				
				pAccumBuffer = 6 * pixel;
				accumBuffer[pAccumBuffer] += accumBuffer[pAccumBuffer + 3] * (1.0 - alphaNew[0]) * vx[0];
				accumBuffer[pAccumBuffer + 1] += accumBuffer[pAccumBuffer + 4] * (1.0 - alphaNew[1]) * vx[1];
				accumBuffer[pAccumBuffer + 2] += accumBuffer[pAccumBuffer + 5] * (1.0 - alphaNew[2]) * vx[2];
				
				accumBuffer[pAccumBuffer + 3] *= alphaNew[0];
				accumBuffer[pAccumBuffer + 4] *= alphaNew[1];
				accumBuffer[pAccumBuffer + 5] *= alphaNew[2];
				
				if((accumBuffer[pAccumBuffer + 3] <= rayTranspThreshold) && (accumBuffer[pAccumBuffer + 4] <= rayTranspThreshold) && (accumBuffer[pAccumBuffer + 5] <= rayTranspThreshold)) {
					rayDead[pixel] = true;
				} else {
					rowDead[y] = false;
				}
			}
			if(!rowDead[y]) {frameDone = false;}
		}
		if(frameDone) {break;}
	}

	pAccumBuffer = 0;
	i = 0;
	for(let y = 0, x; y < bufh; y++) {
		 for(x = 0; x < bufw; x++) {
			//to do: try Uint8Array, Uint8ClampedArray or ArrayBuffer?
			//color = [(255 * 1)|0, (255 * 1)|0, (255 * 1)|0];
			//color = [(255 * 1)|0, (255 * 0.5)|0, (255 * 0)|0];
			//color = [(255 * accumBuffer[pAccumBuffer])|0, (255 * accumBuffer[pAccumBuffer + 1])|0, (255 * accumBuffer[pAccumBuffer + 2])|0];
			
			//color write to pixel
			//i = 4 * (bufw * y + x);
			//data[i] = color[0];
			//data[i + 1] = color[1];
			//data[i + 2] = color[2];
			data[i] = 255 * accumBuffer[pAccumBuffer];
			data[i + 1] = 255 * accumBuffer[pAccumBuffer + 1];
			data[i + 2] = 255 * accumBuffer[pAccumBuffer + 2];
			//data[i + 3] = 255;
			i += 4;
			pAccumBuffer += 6;
		 }
	}
}
