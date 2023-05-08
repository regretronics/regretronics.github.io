"use strict";

//virtual vectorial world context
//var worldRes = new Int8Array([32, 32, 32]);
//var worldRes = new Float32Array([16, 16, 16]);
//var worldRes = [16, 16, 16];
var worldRes = new Uint8Array([16, 16, 16]);
//var worldRes = new Int32Array([16, 16, 16]);
var worldScanEmission = new Float32Array(worldRes[0] * worldRes[1] * worldRes[2] * 4);
var worldScanTransp = new Float32Array(worldRes[0] * worldRes[1] * worldRes[2] * 4);
var texWorldScanEmission, texWorldScanTransp;

function worldVoxelsInit() {
	for(let i = 0; i < worldRes[0] * worldRes[1] * worldRes[2] * 4; i++) {
		worldScanEmission[i] = Math.random();
		worldScanTransp[i] = Math.random();
	}
	
	/*for(let z = 0; z < worldRes[0]; z++) {
		for(let y = 0; y < worldRes[1]; y++) {
			for(let x = 0; x < worldRes[2]; x++) {
				//
			}
		}
	}*/

	texWorldScanEmission = worldScanEmission;
	texWorldScanTransp = worldScanTransp;

	/* var initWorldScanEmission = gpu.createKernel(function() {
		return [Math.random(), Math.random(), Math.random(), 0];
	}, {
		//returnType: 'Array(4)',
		output: [worldRes[0], worldRes[1], worldRes[2]],
		//output: [worldRes[0] * worldRes[1], worldRes[2]],
		//output: [worldRes[0], worldRes[1] * worldRes[2]],
		//immutable: true,
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true
	});//.setOutput([worldRes[0], worldRes[1], worldRes[2]]);
	texWorldScanEmission = initWorldScanEmission();

	var initWorldScanTransp = gpu.createKernel(function() {
		return [Math.random(), Math.random(), Math.random(), 0];
	}, {
		//returnType: 'Array(4)',
		output: [worldRes[0], worldRes[1], worldRes[2]],
		//output: [worldRes[0] * worldRes[1], worldRes[2]],
		//output: [worldRes[0], worldRes[1] * worldRes[2]],
		//immutable: true,
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true
	});//.setOutput([worldRes[0], worldRes[1], worldRes[2]]);
	texWorldScanTransp = initWorldScanTransp(); */
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
//var rayDirs, rayDirsSign;
var rayDirsCol, rayDirsRow;
var /* texRayAlive, texCrossingPoints, texAccumBufferEmission, texAccumBufferTransp, */ texRayDirs, texRayDirsSign;

function clientUpdateSpcTransf() {
	//to do
}

//const opacityFactor = -6 / 65536;
const opacityFactor = -128 * Math.LOG2E / 256;
//const opacityFactor = -128 / 256;

function registerKernels() {
	rayDirs2d = gpu.createKernel(function(rayDirsCol, rayDirsRow) {
		let ray = [
			rayDirsCol[4 * this.thread.y + 0] + rayDirsRow[4 * this.thread.x + 0],
			rayDirsCol[4 * this.thread.y + 1] + rayDirsRow[4 * this.thread.x + 1],
			rayDirsCol[4 * this.thread.y + 2] + rayDirsRow[4 * this.thread.x + 2],
			0.0];
		ray[3] = this.constants.opacityFactor * Math.sqrt(ray[0] * ray[0] + ray[1] * ray[1] + ray[2] * ray[2]);
		return ray;
	}, {
		constants: { opacityFactor: opacityFactor },
		returnType: 'Array(4)',
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	rayDirsSigns = gpu.createKernel(function(rayDirs) {
		let ray = rayDirs[this.thread.y][this.thread.x];
		return [Math.sign(ray[0]), Math.sign(ray[1]), Math.sign(ray[2]), 0.0];
	}, {
		returnType: 'Array(4)',
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});

	resetAccumBufferEmission = gpu.createKernel(function() {
		return [0.0, 0.0, 0.0, 0.0];
	}, {
		returnType: 'Array(4)',
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});
	resetAccumBufferTransp = gpu.createKernel(function() {
		return [1.0, 1.0, 1.0, 1.0];
	}, {
		returnType: 'Array(4)',
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});
	resetRayAlive = gpu.createKernel(function() {
		return 1;
	}, {
		returnType: 'Integer',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});
	resetRayCrossingPoints = gpu.createKernel(function(x, y, z) {
		return [x, y, z, 0.0];
	}, {
		//constants: {},
		argumentTypes: { x: 'Float', y: 'Float', z: 'Float' },
		returnType: 'Array(4)',
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
		//graphical: true
	});

	getDRay = gpu.createKernel(function(rayAlive, rayCrossingPoints, rayDirs, rayDirsSign) {
	//getDRay = gpu.createKernel(function(rayAlive, rayCrossingPoints, rayDirsCol, rayDirsRow) {
		if(rayAlive[this.thread.y][this.thread.x] < 1) return [0.0, 0.0, 0.0, 0.0];
		
		let crossingPoint = rayCrossingPoints[this.thread.y][this.thread.x];
		let coordProjection = [0.0, 0.0, 0.0/* , 0.0 */];
		let rayDirSign = rayDirsSign[this.thread.y][this.thread.x];
		/* let rayDir = [
			rayDirsCol[4 * this.thread.y + 0] + rayDirsRow[4 * this.thread.x + 0],
			rayDirsCol[4 * this.thread.y + 1] + rayDirsRow[4 * this.thread.x + 1],
			rayDirsCol[4 * this.thread.y + 2] + rayDirsRow[4 * this.thread.x + 2],
			0.0];
			rayDir[3] = this.constants.opacityFactor * Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
		let rayDirSign = [Math.sign(rayDir[0]), Math.sign(rayDir[1]), Math.sign(rayDir[2]), 0.0]; */
		coordProjection[0] = Math.floor(rayDirSign[0] * crossingPoint[0] + 1.0);
		coordProjection[1] = Math.floor(rayDirSign[1] * crossingPoint[1] + 1.0);
		coordProjection[2] = Math.floor(rayDirSign[2] * crossingPoint[2] + 1.0);
		
		let crossing = [0.0, 0.0, 0.0/* , 0.0 */];
		let rayDir = rayDirs[this.thread.y][this.thread.x];
		crossing[0] = (rayDirSign[0] * coordProjection[0] - crossingPoint[0]) / rayDir[0];
		crossing[1] = (rayDirSign[1] * coordProjection[1] - crossingPoint[1]) / rayDir[1];
		crossing[2] = (rayDirSign[2] * coordProjection[2] - crossingPoint[2]) / rayDir[2];

		let firstCrossing = 65536.0;
		if(rayDir[0] != 0.0)
			firstCrossing = crossing[0];
		if(rayDir[1] != 0.0 && crossing[1] < firstCrossing)
			firstCrossing = crossing[1];
		if(rayDir[2] != 0.0 && crossing[2] < firstCrossing)
			firstCrossing = crossing[2];

		let dRay = [0.0, 0.0, 0.0, 0.0];
		dRay[0] = firstCrossing * rayDir[0];
		dRay[1] = firstCrossing * rayDir[1];
		dRay[2] = firstCrossing * rayDir[2];
		dRay[3] = firstCrossing * rayDir[3]; //depth, rectilinear projection
		return dRay;
	}, {
		//constants: { opacityFactor: opacityFactor },
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", rayDirs: "Array(4)", rayDirsSign: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	nextCrossingPoints = gpu.createKernel(function(rayAlive, rayCrossingPoints, dRays) {
		//if(rayAlive[this.thread.y][this.thread.x] < 1) return [-1.0, -1.0, -1.0, -1.0];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return [0.0, 0.0, 0.0, 0.0];
		
		let crossingPoint = rayCrossingPoints[this.thread.y][this.thread.x];
		let dRay = dRays[this.thread.y][this.thread.x];
		return [
			crossingPoint[0] + dRay[0],
			crossingPoint[1] + dRay[1],
			crossingPoint[2] + dRay[2],
			0.0];
	}, {
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", dRays: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	pVoxel = gpu.createKernel(function(rayAlive, rayCrossingPoints, dRays) {
		//if(rayAlive[this.thread.y][this.thread.x] < 1) return [-1, -1, -1, -1];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return -1;
		
		let discreteCube = [0, 0, 0, 0];
		let crossingPoint = rayCrossingPoints[this.thread.y][this.thread.x];
		let dRay = dRays[this.thread.y][this.thread.x];
		discreteCube[0] = Math.floor(crossingPoint[0] + 0.5 * dRay[0]);
		discreteCube[1] = Math.floor(crossingPoint[1] + 0.5 * dRay[1]);
		discreteCube[2] = Math.floor(crossingPoint[2] + 0.5 * dRay[2]);

		if(discreteCube[0] >= 0 && discreteCube[0] < this.constants.worldRes0 &&
			discreteCube[1] >= 0 && discreteCube[1] < this.constants.worldRes1 &&
			discreteCube[2] >= 0 && discreteCube[2] < this.constants.worldRes2)
			//return discreteCube;
			return 4 * ((discreteCube[0] * this.constants.worldRes1 + discreteCube[1]) * this.constants.worldRes2 + discreteCube[2]); //to do: check dimension order
		else
			//return [-1, -1, -1, -1];
			return -1;
	}, {
		constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2] },
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", dRays: "Array(4)" },
		returnType: 'Integer',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	newAlpha = gpu.createKernel(function(rayAlive, discreteCube, worldScanTransp, dRays) {
		if(rayAlive[this.thread.y][this.thread.x] < 1) return [0.0, 0.0, 0.0, 0.0];
		//if(rayAlive[this.thread.y][this.thread.x] < 1) return [1.0, 1.0, 1.0, 1.0];
		
		let vxTransp = [0.5, 0.5, 0.5, 0.0];
		let coords = discreteCube[this.thread.y][this.thread.x];
		if(coords >= 0) {
			vxTransp[0] = worldScanTransp[coords + 0];
			vxTransp[1] = worldScanTransp[coords + 1];
			vxTransp[2] = worldScanTransp[coords + 2];
		}
		/* else {
			//to do: special code that fills the remaining transparency and kills the ray
		} */

		let dRay = dRays[this.thread.y][this.thread.x];
		let alphaNew = [0.0, 0.0, 0.0, 0.0];
		alphaNew[0] = Math.exp(dRay[3] * vxTransp[0]);
		alphaNew[1] = Math.exp(dRay[3] * vxTransp[1]);
		alphaNew[2] = Math.exp(dRay[3] * vxTransp[2]);
		return alphaNew;
	}, {
		argumentTypes: { rayAlive: "Integer", discreteCube: "Integer", worldScanTransp: "Array", dRays: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	nextAccumEmission = gpu.createKernel(function(rayAlive, discreteCube, worldScanEmission, alphaNew, accumBufferEmission, accumBufferTransp) {
		let accumEmission = accumBufferEmission[this.thread.y][this.thread.x];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return accumEmission;
		
		let vxEmission = [0.0, 0.5, 1.0, 0.0];
		let coords = discreteCube[this.thread.y][this.thread.x];
		if(coords >= 0) {
			vxEmission[0] = worldScanEmission[coords + 0];
			vxEmission[1] = worldScanEmission[coords + 1];
			vxEmission[2] = worldScanEmission[coords + 2];
		}
		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		let alpha = alphaNew[this.thread.y][this.thread.x];
		return [
			accumEmission[0] + accumTransp[0] * (1.0 - alpha[0]) * vxEmission[0],
			accumEmission[1] + accumTransp[1] * (1.0 - alpha[1]) * vxEmission[1],
			accumEmission[2] + accumTransp[2] * (1.0 - alpha[2]) * vxEmission[2],
			0.0];
	}, {
		argumentTypes: { rayAlive: "Integer", discreteCube: "Integer", worldScanEmission: "Array", alphaNew: "Array(4)", accumBufferEmission: "Array(4)", accumBufferTransp: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	nextAccumTransp = gpu.createKernel(function(rayAlive, alphaNew, accumBufferTransp) {
		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return accumTransp;
		let alpha = alphaNew[this.thread.y][this.thread.x];
		return [
			accumTransp[0] * alpha[0],
			accumTransp[1] * alpha[1],
			accumTransp[2] * alpha[2],
			0.0];
	}, {
		argumentTypes: { rayAlive: "Integer", alphaNew: "Array(4)", accumBufferTransp: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	nextRayAlive = gpu.createKernel(function(rayAlive, accumBufferTransp) {
		if(rayAlive[this.thread.y][this.thread.x] < 1) return 0;

		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		if(accumTransp[0] <= this.constants.rayTranspThreshold &&
			accumTransp[1] <= this.constants.rayTranspThreshold &&
			accumTransp[2] <= this.constants.rayTranspThreshold)
			return 0;
		else
			return 1;
	}, {
		constants: { rayTranspThreshold: rayTranspThreshold },
		argumentTypes: { rayAlive: "Integer", accumBufferTransp: "Array(4)" },
		returnType: 'Integer',
		//optimizeFloatMemory: true,
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});

	renderAccum = gpu.createKernel(function(accumBufferEmission, accumBufferTransp) {
		let accumEmission = accumBufferEmission[this.thread.y][this.thread.x];
		//let color = accumEmission;

		let color = [0.5, 0.5, 0.5/* , 0.0 */];
		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		let alphaNew = [1.0 - accumTransp[0], 1.0 - accumTransp[1], 1.0 - accumTransp[2]];
		if(alphaNew[0] > 0) color[0] = accumEmission[0] / alphaNew[0];
		if(alphaNew[1] > 0) color[1] = accumEmission[1] / alphaNew[1];
		if(alphaNew[2] > 0) color[2] = accumEmission[2] / alphaNew[2];

		this.color(color[0], color[1], color[2]);
	}, {
		argumentTypes: {accumBufferEmission: "Array(4)", accumBufferTransp: "Array(4)"},
		//argumentTypes: {accumBufferEmission: "TextureArray(4)", accumBufferTransp: "TextureArray(4)"},
		//output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		graphical: true
	});
}

function viewRayDirsCompute_Rectilinear(ch, cw) {
	let chInv = 1 / ch;
	
	rayDirsRow = new Float32Array(cw * 4);
	let x, xf;
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		rayDirsRow[4 * x    ] = clientSpcTransf[0] * xf;
		rayDirsRow[4 * x + 1] = clientSpcTransf[1] * xf;
		rayDirsRow[4 * x + 2] = clientSpcTransf[2] * xf;
	}

	rayDirsCol = new Float32Array(ch * 4);
	for(x = 0; x < ch; x++) {
		xf = clientFoVH * (2.0 * (x + 0.5) * chInv - 1.0);
		rayDirsCol[4 * x    ] = clientSpcTransf[6] + clientSpcTransf[3] * xf;
		rayDirsCol[4 * x + 1] = clientSpcTransf[7] + clientSpcTransf[4] * xf;
		rayDirsCol[4 * x + 2] = clientSpcTransf[8] + clientSpcTransf[5] * xf;
	}
	
	texRayDirs = rayDirs2d(rayDirsCol, rayDirsRow);
	texRayDirsSign = rayDirsSigns(texRayDirs);
}

var frameMaxLayers = 96;
//var frameMaxLayers = 16;
const rayTranspThreshold = 1 / 96;

//function frameRenderRaycasting(canvas, timeout) {
function frameRenderRaycasting(bufH, bufW, timeout) {
	//let bufH = canvas.height|0, bufW = canvas.width|0;
	let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now();
	
	//Some initialization
	let texRayAlive = resetRayAlive();
	let texAccumBufferEmission = resetAccumBufferEmission();
	let texAccumBufferTransp = resetAccumBufferTransp();
	let texCrossingPoints = resetRayCrossingPoints(clientPos[0], clientPos[1], clientPos[2]);
	
	let dRays, pVoxels, newAlphas;
	segmentCount = 0;
	for(let z = 0, y, x; z < frameMaxLayers; z++) {
		dRays = getDRay(texRayAlive, texCrossingPoints, texRayDirs, texRayDirsSign);
		//dRays = getDRay(texRayAlive, texCrossingPoints, rayDirsCol, rayDirsRow);
		let newCrossingPoints = nextCrossingPoints(texRayAlive, texCrossingPoints, dRays);
		pVoxels = pVoxel(texRayAlive, texCrossingPoints, dRays);
		newAlphas = newAlpha(texRayAlive, pVoxels, texWorldScanTransp, dRays);
		let newAccumEmission = nextAccumEmission(texRayAlive, pVoxels, texWorldScanEmission, newAlphas, texAccumBufferEmission, texAccumBufferTransp);
		let newAccumTransp = nextAccumTransp(texRayAlive, newAlphas, texAccumBufferTransp);
		let newRayAlive = nextRayAlive(texRayAlive, newAccumTransp);

		dRays.delete();
		pVoxels.delete();
		newAlphas.delete();
		/* dRays.clear();
		pVoxels.clear();
		newAlphas.clear(); */

		/* texCrossingPoints.clear();
		texAccumBufferEmission.clear();
		texAccumBufferTransp.clear();
		texRayAlive.clear(); */
		texCrossingPoints.delete();
		texAccumBufferEmission.delete();
		texAccumBufferTransp.delete();
		texRayAlive.delete();
		texCrossingPoints = newCrossingPoints;
		texAccumBufferEmission = newAccumEmission;
		texAccumBufferTransp = newAccumTransp;
		texRayAlive = newRayAlive;

		let rayAliveArr = newRayAlive.toArray(), frameSegCount = 0;
		for(y = 0; y < bufH; y++) {
			const row = rayAliveArr[y];
			for(x = 0; x < bufW; x++) {
				frameSegCount += row[x];
			}
		}
		segmentCount += frameSegCount;
		if(frameSegCount === 0 || (timeoutEnabled && ((performance.now() - tStart) * (z + 2) / (z + 1)) > timeout)) break;
	}
	texCrossingPoints.delete();
	texRayAlive.delete();

	renderAccum(texAccumBufferEmission, texAccumBufferTransp);
	texAccumBufferEmission.delete();
	texAccumBufferTransp.delete();
}
