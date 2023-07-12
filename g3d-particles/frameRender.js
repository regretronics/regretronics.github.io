"use strict";

//virtual matricial field context
//const worldSize = 16;
//const worldSize = 32;
//const worldSize = 64;
//const worldSize = 96;
//const worldSize = 128;
//const worldSize = 192;
//const worldSize = 256;
//const worldSize = 384;
var worldSize = 64;
//var worldRes =
//var worldRes = new Int8Array(
//var worldRes = new Uint8Array(
var worldRes = new Int32Array(
//var worldRes = new Float32Array(
	[worldSize, worldSize, worldSize]);

//--
//virtual vectorial client context
//basically done.
//var clientPos = new Float32Array(3), clientRot = new Float32Array(9);
//var clientPos = new Float32Array([0.5 * worldRes[0] + 0.5, 0.5 * worldRes[1] + 0.5, 0.375 * worldRes[2] + 0.5, 0.0]);
var clientPos = new Float32Array([0.5 * worldRes[0] + 4.5, 0.5 * worldRes[1] + 4.5, 0.375 * worldRes[2] + 0.5, 0.0]);
var clientSpcTransf = new Float32Array([
	1, 0, 0,
	0, 1, 0,
	0, 0, 1]);
var clientSpcTransfInv = new Float32Array([
	1, 0, 0,
	0, 1, 0,
	0, 0, 1]);
var clientFoVH = 1;
var rayDirsCol, rayDirsRow;
var rowNormals, colNormals;
//var texNormalsCol, texNormalsRow;
var texRayDirs, texRayDirsSign;

const opacityFactor = -128 * Math.LN2 / 256;
//const opacityFactor = -128 / 256;

var generalKernels/* , fieldKernels, rcKernels0, rcKernels1 */;
function registerKernels() { //to do: Delete?
	generalKernels = registerGeneralKernels(gpu);
}
function registerGeneralKernels(gpu) {
	let newKernels = {};
	newKernels.rayDirs2d = gpu.createKernel(function(rayDirsCol, rayDirsRow) {
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
		output: [cw, ch],
		//immutable: true,
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true
	});
	newKernels.rayDirsSigns = gpu.createKernel(function(rayDirs) {
		let ray = rayDirs[this.thread.y][this.thread.x];
		return [Math.sign(ray[0]), Math.sign(ray[1]), Math.sign(ray[2]), 0.0];
	}, {
		returnType: 'Array(4)',
		output: [cw, ch],
		//immutable: true,
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true
	});

	/* newKernels.renderAccum = gpu.createKernel(function(accumBufferEmission, accumBufferTransp) {
		let accumEmission = accumBufferEmission[this.thread.y][this.thread.x];
		//let color = accumEmission;

		let color = [0.5, 0.5, 0.5];
		//let color = [0.5, 0.5, 0.5, 0.0];
		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		let alphaNew = [1.0 - accumTransp[0], 1.0 - accumTransp[1], 1.0 - accumTransp[2]];
		if(alphaNew[0] > 0) color[0] = accumEmission[0] / alphaNew[0];
		if(alphaNew[1] > 0) color[1] = accumEmission[1] / alphaNew[1];
		if(alphaNew[2] > 0) color[2] = accumEmission[2] / alphaNew[2];

		this.color(color[0], color[1], color[2]);
	}, {
		argumentTypes: {accumBufferEmission: "Array(4)", accumBufferTransp: "Array(4)"},
		//argumentTypes: {accumBufferEmission: "TextureArray(4)", accumBufferTransp: "TextureArray(4)"},
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		graphical: true
		//to do: precision
	}); */
	newKernels.drawPixels = gpu.createKernel(function(buf, cw, ch) {
		const pPixel = 4 * (this.thread.y * cw + this.thread.x);
		this.color(buf[pPixel], buf[pPixel + 1], buf[pPixel + 2]);
	}, {
		//argumentTypes: {accumBufferEmission: "Array(4)", accumBufferTransp: "Array(4)"},
		//argumentTypes: {accumBufferEmission: "TextureArray(4)", accumBufferTransp: "TextureArray(4)"},
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		graphical: true
		//to do: precision
	});
	return newKernels;
}

function canvasSizeChange(newCW, newCH) {
	ch = newCH;
	cw = newCW;

	releaseCanvasResources(); //Dispose canvas-related kernels, etc.

	//Recreate kernels, except field-related ones
	generalKernels = registerGeneralKernels(gpu);

	//From registerKernels
	/* generalKernels.rayDirs2d.setOutput([cw, ch]);
	generalKernels.rayDirsSigns.setOutput([cw, ch]); */

	//rcKernelsSetDimensions(rcKernels0);
	//rcKernelsSetDimensions(rcKernels1);

	viewRayDirsCompute_Rectilinear(ch, cw);
	//texBuffer0 = {};
	//texBuffer1 = {};

	//force-compile
	frameRenderRaycasting(1);

	mainCanvas.height = ch;
	mainCanvas.width = cw;
}
function rcKernelsSetDimensions(rcKernels) {
	//From registerRayCastingKernels
	/* rcKernels.getDRay.setOutput([cw, ch]);
	rcKernels.nextCrossingPoints.setOutput([cw, ch]);
	rcKernels.pVoxel.setOutput([cw, ch]);
	rcKernels.segTransp.setOutput([cw, ch]);
	rcKernels.nextAccumEmission.setOutput([cw, ch]);
	rcKernels.nextAccumTransp.setOutput([cw, ch]);
	rcKernels.nextRayAlive.setOutput([cw, ch]); */

	//From registerRayCastingKernelMono
	//rcKernels.rayCaster.setOutput([cw, ch]);
	//rcKernels.renderTex.setOutput([cw, ch]);

	//From registerRayCastingKernelMap
	//rcKernels.rayCastingCycle.setOutput([cw, ch]);
}

/* function viewRayDirsCompute_Rectilinear(ch, cw) {
	let chInv = 1 / ch;
	
	rayDirsCol = new Float32Array(ch * 4);
	let x, xf;
	for(x = 0; x < ch; x++) {
		xf = clientFoVH * (2.0 * (x + 0.5) * chInv - 1.0);
		rayDirsCol[4 * x    ] = clientSpcTransf[6] + clientSpcTransf[3] * xf;
		rayDirsCol[4 * x + 1] = clientSpcTransf[7] + clientSpcTransf[4] * xf;
		rayDirsCol[4 * x + 2] = clientSpcTransf[8] + clientSpcTransf[5] * xf;
	}
	
	rayDirsRow = new Float32Array(cw * 4);
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		rayDirsRow[4 * x    ] = clientSpcTransf[0] * xf;
		rayDirsRow[4 * x + 1] = clientSpcTransf[1] * xf;
		rayDirsRow[4 * x + 2] = clientSpcTransf[2] * xf;
	}

	texRayDirs = generalKernels.rayDirs2d(rayDirsCol, rayDirsRow);
	texRayDirsSign = generalKernels.rayDirsSigns(texRayDirs);
} */
function viewRayDirsCompute_Rectilinear(ch, cw) {
	let chInv = 1.0 / ch;
	
	rayDirsCol = new Float32Array(ch * 4);
	rowNormals = new Float32Array(ch * 4);
	let x, xf, lenInv;
	for(x = 0; x < ch; x++) {
		xf = clientFoVH * (2.0 * (x + 0.5) * chInv - 1.0);
		lenInv = 1.0 / Math.sqrt(1.0 + xf * xf);
		rayDirsCol[4 * x    ] = 0.0;
		rayDirsCol[4 * x + 1] = xf;
		rayDirsCol[4 * x + 2] = 1.0;

		rowNormals[4 * x    ] = 0.0;
		rowNormals[4 * x + 1] = -1.0 * lenInv;
		rowNormals[4 * x + 2] = xf * lenInv;
	}
	
	rayDirsRow = new Float32Array(cw * 4);
	colNormals = new Float32Array(cw * 4);
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		lenInv = 1.0 / Math.sqrt(1.0 + xf * xf);
		rayDirsRow[4 * x    ] = xf;
		rayDirsRow[4 * x + 1] = 0.0;
		rayDirsRow[4 * x + 2] = 0.0;

		colNormals[4 * x    ] = -1.0 * lenInv;
		colNormals[4 * x + 1] = 0.0;
		colNormals[4 * x + 2] = xf * lenInv;
	}

	//texRayDirs = generalKernels.rayDirs2d(rayDirsCol, rayDirsRow);
	//texRayDirsSign = generalKernels.rayDirsSigns(texRayDirs);
	//texNormalsCol = gpu.input(normalsCol, [normalsCol.length]); //to do: check case
	//texNormalsRow = gpu.input(normalsRow, [normalsRow.length]); //to do: check case
}

//var frameMaxLayers = 96;
//var frameMaxLayers = 64;
//var frameMaxLayers = 48;
//var frameMaxLayers = 32;
//var frameMaxLayers = 24;
//var frameMaxLayers = 16;
//const rayTranspThreshold = 1.0 / 96.0;
const rayTranspThreshold = 1.0 / 128.0;

function frameRenderRaycasting(/* bufH, bufW, */ /* timeout */ layerCount) {
	/* let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now(); */
	
	//to do: use gpu.input
	//const imgData = new ImageData(cw, ch);
	//const imgArr = imgData.data;
	const imgArr = new Float32Array(4 * cw * ch);
	for(let y = 0; y < ch; y++) {
		//Filter particles that cross a row
		const particlesInRow = [];
		for(let j = 0; j < particlesZSorted.length; j++) {
			const p = particlesZSorted[j].i;
			const rowNormal = [rowNormals[4 * y], rowNormals[4 * y + 1], rowNormals[4 * y + 2]];
			const d = Math.abs(partPosLocal[4 * p] * rowNormal[0] + partPosLocal[4 * p + 1] * rowNormal[1] + partPosLocal[4 * p + 2] * rowNormal[2]);
			const r = particles.r[p]; //Particle -> ball
			if(d < r)
				particlesInRow.push({i: p, rem: r * r - d * d}); //Remainder = other catheti squared
		}

		//const particlesInRays = [];
		for(let x = 0; x < cw; x++) {
			//Further filter to particles that cross a column
			const particlesInRay = [];
			for(let j = 0; j < particlesInRow.length; j++) {
				const particleRec = particlesInRow[j];
				const p = particleRec.i;
				const pos = [partPosLocal[4 * p], partPosLocal[4 * p + 1], partPosLocal[4 * p + 2]];
				const colNormal = [colNormals[4 * x], colNormals[4 * x + 1], colNormals[4 * x + 2]];
				const d = pos[0] * colNormal[0] + pos[1] * colNormal[1] + pos[2] * colNormal[2];
				let d2 = particleRec.rem - d * d;
				if(d2 > 0.0) {
					const rem2 = Math.sqrt(d2);
					//const rayDir = [rayDirsCol[4 * y] + rayDirsRow[4 * x], rayDirsCol[4 * y + 1] + rayDirsRow[4 * x + 1], rayDirsCol[4 * y + 2] + rayDirsRow[4 * x + 2]];
					const rayDir = [rayDirsRow[4 * x], rayDirsCol[4 * y + 1], rayDirsCol[4 * y + 2]];
					const rayDirFactor = 1.0 / Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
					const z = rayDirFactor * (rayDir[0] * pos[0] + rayDir[1] * pos[1] + rayDir[2] * pos[2]);
					particlesInRay.push({i: p, z: z - rem2, st: true});
					particlesInRay.push({i: p, z: z + rem2, st: false});
				}
			}
			particlesInRay.sort((a, b) => (a.z - b.z));
			
			//Render particles by segment sections as they cross the ray
			let em0 = 0.0, em1 = 0.0, em2 = 0.0;
			let alpha0 = 1.0, alpha1 = 1.0, alpha2 = 1.0;

			const localParticleSet = new Set();
			let j = 0, z = 0.0, z2 = 0.0;
			while(j < particlesInRay.length) {
				for(; j < particlesInRay.length; j++) {
					const elem = particlesInRay[j];
					z2 = elem.z;
					if(z2 > z) break;
					if(elem.st)
						localParticleSet.add(elem.i);
					else
						localParticleSet.delete(elem.i);
				}
				if(z2 > z) {
					let localEm0 = 0.0, localEm1 = 0.0, localEm2 = 0.0;
					let localAlpha0 = 0.0, localAlpha1 = 0.0, localAlpha2 = 0.0;
					if(localParticleSet.size > 0) {
						//Accumulate (sum) colors of particles present in the segment
						for(const part of localParticleSet) {
							const segAlpha0 = particles.alpha[4 * part    ];
							const segAlpha1 = particles.alpha[4 * part + 1];
							const segAlpha2 = particles.alpha[4 * part + 2];
							localEm0 += particles.emission[4 * part    ] * segAlpha0;
							localEm1 += particles.emission[4 * part + 1] * segAlpha1;
							localEm2 += particles.emission[4 * part + 2] * segAlpha2;
							localAlpha0 += segAlpha0;
							localAlpha1 += segAlpha1;
							localAlpha2 += segAlpha2;
						}
						localEm0 /= localAlpha0;
						localEm1 /= localAlpha1;
						localEm2 /= localAlpha2;
						/* localEm0 = 1.0 / 4.0;
						localAlpha0 = 1.0; */
					} else {
						//Fog
						localAlpha0 = 0.0625;
						localAlpha1 = 0.0625;
						localAlpha2 = 0.0625;
						localEm0 = 0.0;
						localEm1 = 0.0;
						localEm2 = 0.0;
					}
					//Render ray segment into fragment (alpha blend)
					const factor = opacityFactor * (z2 - z);
					const segAlpha0 = Math.exp(factor * localAlpha0);
					const segAlpha1 = Math.exp(factor * localAlpha1);
					const segAlpha2 = Math.exp(factor * localAlpha2);
					em0 += alpha0 * localEm0 * (1.0 - segAlpha0);
					em1 += alpha1 * localEm1 * (1.0 - segAlpha1);
					em2 += alpha2 * localEm2 * (1.0 - segAlpha2);
					alpha0 *= segAlpha0;
					alpha1 *= segAlpha1;
					alpha2 *= segAlpha2;
				}
				z = z2;
			}

			//particlesInRays.push(particlesInRay);
			if(alpha0 === 1.0) em0 = 0.0; else em0 /= (1.0 - alpha0);
			if(alpha1 === 1.0) em1 = 0.0; else em1 /= (1.0 - alpha1);
			if(alpha2 === 1.0) em2 = 0.0; else em2 /= (1.0 - alpha2);
			/* if(alpha0 !== 1.0) em0 /= (1.0 - alpha0);
			if(alpha1 !== 1.0) em1 /= (1.0 - alpha1);
			if(alpha2 !== 1.0) em2 /= (1.0 - alpha2); */
			const pPixel = 4 * (y * cw + x);
			imgArr[pPixel    ] = em0;
			imgArr[pPixel + 1] = em1;
			imgArr[pPixel + 2] = em2;
			/* imgArr[pPixel    ] = alpha0;
			imgArr[pPixel + 1] = alpha1;
			imgArr[pPixel + 2] = alpha2; */
		}
		//texParticles = gpu.input(particlesZSortedArr, [particlesZSortedArr.length]); //to do: check case
	}
	generalKernels.drawPixels(imgArr, cw, ch);
}
