"use strict";
function frameRenderSimple(imgData) {
	let data = imgData.data, i;
	//note: the alpha channel must be also set for the result to be visible.

	//fill the whole buffer with the same color.
	let l = data.length;
	//simplifying the loop condition is also a loop optimization.
	for(i = 0; i < l; i += 4) {
		data[i] = 191;
		data[i + 1] = 191;
		data[i + 2] = 191;
		//data[i + 3] = 128;
	}

	//let bufH = imgData.height, bufW = imgData.width;
	//rectangular fill (opaque)
	/*for(let y = 0; y < 256; y++) {
		for(let x = 64; x < 64 + 256; x++) {
			i = 4 * (bufW * y + x);
			data[i] = 255;
			data[i + 1] = 128;
			data[i + 2] = 0;
			data[i + 3] = 255;
		}
	}*/
}

/* const exp2LUTScale = 64, exp2LUTSize = exp2LUTScale;
var exp2LUT;

function exp2LUTInit() {
	for(let i = 0; i < exp2LUTSize; i++)
		exp2LUT[i] = Math.exp(Math.LN2 * i / exp2LUTScale);
}
exp2LUT = new Float32Array(exp2LUTSize);
exp2LUTInit(); */

//--
//virtual vectorial world context
var worldRes = new Int8Array([32, 32, 32]);
//var worldRes = new Uint8Array([16, 16, 16]);
//var worldRes = new Int32Array([16, 16, 16]);
var worldScan = new Float32Array(worldRes[0] * worldRes[1] * worldRes[2] * 3 * 2);
var emptyVoxel = new Float32Array([0.0, 0.5, 1.0, 0.5, 0.5, 0.5]);

function worldVoxelsInit() {
	for(let i = 0; i < worldRes[0] * worldRes[1] * worldRes[2] * 3 * 2; i++) {
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
//basically done.
//var clientPos = new Float32Array(3), clientRot = new Float32Array(9);
var clientPos = new Float32Array([0.5 * worldRes[0] + 0.5, 0.5 * worldRes[1] + 0.5, 0.5 * worldRes[2] + 0.5]);
var clientSpcTransf = new Float32Array([
 1, 0, 0,
 0, 1, 0,
 0, 0, 1]);
var clientFoVH = 1;
var rayDirs, rayDirsSign;

function clientUpdateSpcTransf() {
	//to do
}

//const opacityFactor = -6 / 65536;
//const opacityFactor = -128 * Math.LOG2E / 256;
const opacityFactor = -128 / 256;

function viewRayDirsCompute_Rectilinear(ch, cw) {
	let chInv = 1 / ch;
	if(rayDirs == undefined || rayDirs.length != ch * cw * 4)
		rayDirs = new Float32Array(ch * cw * 4);
	if(rayDirsSign == undefined || rayDirsSign.length != ch * cw * 4)
		//rayDirsSign = new Float32Array(ch * cw * 3);
		rayDirsSign = new Int8Array(ch * cw * 4);
		//rayDirsSign = new Int32Array(ch * cw * 3);
	
	let rayDirsRow = new Float32Array(cw * 4);
	let x, xf;
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		rayDirsRow[4 * x] = clientSpcTransf[0] * xf;
		rayDirsRow[4 * x + 1] = clientSpcTransf[1] * xf;
		rayDirsRow[4 * x + 2] = clientSpcTransf[2] * xf;
	}
	
	for(let rayDirs0 = new Float32Array(3), y = 0, yf, pRow = 0, pCol, pRayDirs = 0;//, pRayDirsSign = 0;
	 y < ch;
	 y++) {
		yf = clientFoVH * (2.0 * (y + 0.5) * chInv - 1.0);
		rayDirs0[0] = clientSpcTransf[6] * 1.0 + clientSpcTransf[3] * yf;
		rayDirs0[1] = clientSpcTransf[7] * 1.0 + clientSpcTransf[4] * yf;
		rayDirs0[2] = clientSpcTransf[8] * 1.0 + clientSpcTransf[5] * yf;
		
		for(x = 0, pCol = 0; x < cw; x++) {
			//xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;

			pRayDirs = pRow + pCol;
			rayDirs[pRayDirs    ] = rayDirs0[0] + rayDirsRow[pCol    ];
			rayDirsSign[pRayDirs    ] = Math.sign(rayDirs[pRayDirs    ]);
			rayDirs[pRayDirs + 1] = rayDirs0[1] + rayDirsRow[pCol + 1];
			rayDirsSign[pRayDirs + 1] = Math.sign(rayDirs[pRayDirs + 1]);
			rayDirs[pRayDirs + 2] = rayDirs0[2] + rayDirsRow[pCol + 2];
			rayDirsSign[pRayDirs + 2] = Math.sign(rayDirs[pRayDirs + 2]);
			rayDirs[pRayDirs + 3] = opacityFactor * Math.sqrt(rayDirs[pRayDirs] * rayDirs[pRayDirs] + rayDirs[pRayDirs + 1] * rayDirs[pRayDirs + 1] + rayDirs[pRayDirs + 2] * rayDirs[pRayDirs + 2]);
			
			pCol += 4;
			//pRayDirsSign += 3;
		}
		pRow += 4 * cw;
	}
}

var rayCrossingPoints, rayDead, rowDead, /*rayPosColor,*/ accumBuffer;
var frameMaxLayers = 96;
const rayTranspThreshold = 1 / 96;
const initialVoxel = new Float32Array([0, 0, 0, 1, 1, 1]);

//to do: multithreaded rendering
function frameRenderRaycasting(imgData, timeout) {
	let data = imgData.data;
	let bufH = imgData.height|0, bufW = imgData.width|0;
	//let timeoutEnabled = (typeof(timeout) === "number"), tLimit;
	let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	//if(timeoutEnabled) tLimit = Date.now() + timeout;
	if(timeoutEnabled) tStart = Date.now();
	
	//some initialization
	for(let x = 0; x < bufH * bufW; x++)
		rayCrossingPoints.set(clientPos, x * 4);
	
	for(let x = 0; x < bufH * bufW; x++)
		accumBuffer.set(initialVoxel, x * 6);
	
	for(let x = 0; x < bufH * bufW; x++) rayDead[x] = 0;
	for(let y = 0; y < bufH; y++) rowDead[y] = 0;
	
	//let pRayCrossingPoints = 0, pAccumBuffer = 0;
	//let /*pRayPosColor = 0,*/ pRayDirs, pRayDirsSign;
	let firstCrossing, rayCoordCrossing, depth;
	let alphaNew = new Float32Array(3), discreteCube = new Int8Array(3);
	//let alphaNew = new Float32Array(3), discreteCube = new Uint8Array(3);
	//let alphaNew = new Float32Array(3), discreteCube = new Int32Array(3);
	//let color = new Float32Array(3); //?
	segmentCount = 0;
	for(let z = 0, frameDone, y, x, pPixel; z < frameMaxLayers; z++) {
		frameDone = true;
		//let coordProjection = new Array(3);
		//let coordProjection = new Float32Array(3), coordProjection2 = new Float32Array(3);
		//let coordProjection = new Float32Array(8);
		//let dRay = new Float32Array(4);
		//let vx = new Float32Array(6);
		for(y = 0, pPixel = 0; y < bufH; y++) {
			if(rowDead[y]) {
			//if(rowDead[y] !== 0) {
				//pFragmentValue += bufW;
				pPixel += bufW;
				continue;
			} else
				rowDead[y] = 1;
			for(x = 0; x < bufW; x++, pPixel++) {
				if(rayDead[pPixel])
				//if(rayDead[pPixel] !== 0)
					continue;
				
				/*let pRayCrossingPoints = pPixel * 4;
				let pRayDirs = pPixel * 4;
				let pRayDirsSign = pPixel * 4;*/
				let pPixel4 = pPixel * 4, coordProjection;
				
				//find the next crossing with the regular voxel grid in some axis
				//per axis, finds the t parameter (of the line formula) for the first crossing with a voxel boundary
				if(rayDirs[pPixel4] === 0)
					firstCrossing = 65536;
				else {
					//todo: use abs, or even copysignf?
					coordProjection = Math.floor(rayDirsSign[pPixel4] * rayCrossingPoints[pPixel4] + 1);
					firstCrossing = (rayDirsSign[pPixel4] * coordProjection - rayCrossingPoints[pPixel4]) / rayDirs[pPixel4];
				}

				if(rayDirs[pPixel4 + 1] !== 0) {
					coordProjection = Math.floor(rayDirsSign[pPixel4 + 1] * rayCrossingPoints[pPixel4 + 1] + 1);
					rayCoordCrossing = (rayDirsSign[pPixel4 + 1] * coordProjection - rayCrossingPoints[pPixel4 + 1]) / rayDirs[pPixel4 + 1];
					if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
				}

				if(rayDirs[pPixel4 + 2] !== 0) {
					coordProjection = Math.floor(rayDirsSign[pPixel4 + 2] * rayCrossingPoints[pPixel4 + 2] + 1);
					rayCoordCrossing = (rayDirsSign[pPixel4 + 2] * coordProjection - rayCrossingPoints[pPixel4 + 2]) / rayDirs[pPixel4 + 2];
					if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
				}
				
				discreteCube[0] = Math.floor(rayCrossingPoints[pPixel4] + 0.5 * firstCrossing * rayDirs[pPixel4]);
				discreteCube[1] = Math.floor(rayCrossingPoints[pPixel4 + 1] + 0.5 * firstCrossing * rayDirs[pPixel4 + 1]);
				discreteCube[2] = Math.floor(rayCrossingPoints[pPixel4 + 2] + 0.5 * firstCrossing * rayDirs[pPixel4 + 2]);

				rayCrossingPoints[pPixel4] += firstCrossing * rayDirs[pPixel4];
				rayCrossingPoints[pPixel4 + 1] += firstCrossing * rayDirs[pPixel4 + 1];
				rayCrossingPoints[pPixel4 + 2] += firstCrossing * rayDirs[pPixel4 + 2];

				//to do: ?maybe pre-normalize vector length for rectilinear projection as well
				depth = firstCrossing * rayDirs[pPixel4 + 3]; //rectilinear projection
				//depth = /* opacityFactor * */ firstCrossing; //globular projection has equal-length rays

				let vx;
				if(discreteCube[0] >= 0 && discreteCube[0] < worldRes[0] &&
				 discreteCube[1] >= 0 && discreteCube[1] < worldRes[1] &&
				 discreteCube[2] >= 0 && discreteCube[2] < worldRes[2]) {
					let pVoxel = (discreteCube[0] * worldRes[1] + discreteCube[1]) * worldRes[2] + discreteCube[2];
					//vx = worldScan.slice(6 * pVoxel, 6 * pVoxel + 6);
					//vx = worldScan.slice(pVoxel * 6, (pVoxel + 1) * 6);
					//vx.set(worldScan.slice(pVoxel * 6, (pVoxel + 1) * 6), 0);
					vx = worldScan.subarray(pVoxel * 6, (pVoxel + 1) * 6);
				} else
					vx = emptyVoxel; //to do: special code that fills the remaining transparency and kills the ray
					//vx.set(emptyVoxel, 0);

				/*alphaNew[0] = Math.exp(depth * vx[3]);
				alphaNew[1] = Math.exp(depth * vx[4]);
				alphaNew[2] = Math.exp(depth * vx[5]);*/
				/* alphaNew[0] = exp2_LUT(depth * vx[3]);
				alphaNew[1] = exp2_LUT(depth * vx[4]);
				alphaNew[2] = exp2_LUT(depth * vx[5]); */
				alphaNew[0] = exp2_fast(depth * vx[3]);
				alphaNew[1] = exp2_fast(depth * vx[4]);
				alphaNew[2] = exp2_fast(depth * vx[5]);
				
				let pAccumBuffer = pPixel * 6;
				accumBuffer[pAccumBuffer    ] += accumBuffer[pAccumBuffer + 3] * (1.0 - alphaNew[0]) * vx[0];
				accumBuffer[pAccumBuffer + 1] += accumBuffer[pAccumBuffer + 4] * (1.0 - alphaNew[1]) * vx[1];
				accumBuffer[pAccumBuffer + 2] += accumBuffer[pAccumBuffer + 5] * (1.0 - alphaNew[2]) * vx[2];
				
				accumBuffer[pAccumBuffer + 3] *= alphaNew[0];
				accumBuffer[pAccumBuffer + 4] *= alphaNew[1];
				accumBuffer[pAccumBuffer + 5] *= alphaNew[2];
				
				segmentCount++;
				if(accumBuffer[pAccumBuffer + 3] <= rayTranspThreshold &&
					accumBuffer[pAccumBuffer + 4] <= rayTranspThreshold &&
					accumBuffer[pAccumBuffer + 5] <= rayTranspThreshold)
					//rayDead[pPixel] = true;
					rayDead[pPixel] = 1;
				else
					//rowDead[y] = false;
					rowDead[y] = 0;
			}
			if(!rowDead[y]) frameDone = false;
			//if(rowDead[y] === 0) frameDone = false;
		}
		//if(frameDone || (timeoutEnabled && Date.now() >= tLimit)) break;
		if(frameDone || (timeoutEnabled && ((Date.now() - tStart) * (z + 2) / (z + 1)) > timeout)) break;
	}

	for(let x = 0; x < bufH * bufW; x++) {
		alphaNew[0] = 1.0 - accumBuffer[6 * x + 3];
		alphaNew[1] = 1.0 - accumBuffer[6 * x + 4];
		alphaNew[2] = 1.0 - accumBuffer[6 * x + 5];
		if(alphaNew[0] <= 0) data[4 * x] = 128; else data[4 * x] = 255 * accumBuffer[6 * x] / alphaNew[0];
		if(alphaNew[1] <= 0) data[4 * x + 1] = 128; else data[4 * x + 1] = 255 * accumBuffer[6 * x + 1] / alphaNew[1];
		if(alphaNew[2] <= 0) data[4 * x + 2] = 128; else data[4 * x + 2] = 255 * accumBuffer[6 * x + 2] / alphaNew[2];
		/*data[4 * x] = 255 * accumBuffer[6 * x];
		data[4 * x + 1] = 255 * accumBuffer[6 * x + 1];
		data[4 * x + 2] = 255 * accumBuffer[6 * x + 2];*/
		//data[i + 3] = 255;
	}
}
