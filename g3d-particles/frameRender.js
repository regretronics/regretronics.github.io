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

	newKernels.rayCastRow = gpu.createKernel(function(alphaArr, emissionArr, stopCount, indexes, depths, extremes, arrDepth, cw) {
		//Render particles by segment sections as they cross the ray
		let em = [0.0, 0.0, 0.0, 0.0];
		let alpha = [1.0, 1.0, 1.0/* , 1.0 */];

		let chordEm = [0.0, 0.0, 0.0/* , 0.0 */];
		let chordAlpha = [0.0, 0.0, 0.0/* , 0.0 */];

		let j = 0, z = 0.0, z2 = 0.0;
		let crossingParticles = 0;
		const pPixel = this.thread.y * cw + this.thread.x;
		const pPixel2 = pPixel * arrDepth;
		while(j < stopCount[pPixel] && j < arrDepth) {
			for(; j < stopCount[pPixel] && j < arrDepth; j++) {
				//z2 = depths[pPixel][j];
				z2 = depths[pPixel2 + j];
				if(z2 > z) break;

				//const i = 4 * indexes[pPixel][j];
				const i = 4 * indexes[pPixel2 + j];
				const partAlpha = [alphaArr[i], alphaArr[i + 1], alphaArr[i + 2]/* , 0.0 */];
				//if(extremes[pPixel][j] > 0) { //Accumulate (sum) colors of particles present in the segment
				if(extremes[pPixel2 + j] > 0) { //Accumulate (sum) colors of particles present in the segment
					chordAlpha[0] += partAlpha[0];
					chordAlpha[1] += partAlpha[1];
					chordAlpha[2] += partAlpha[2];
					chordEm[0] += partAlpha[0] * emissionArr[i];
					chordEm[1] += partAlpha[1] * emissionArr[i + 1];
					chordEm[2] += partAlpha[2] * emissionArr[i + 2];
					crossingParticles++;
				} else {
					chordAlpha[0] -= partAlpha[0];
					chordAlpha[1] -= partAlpha[1];
					chordAlpha[2] -= partAlpha[2];
					chordEm[0] -= partAlpha[0] * emissionArr[i];
					chordEm[1] -= partAlpha[1] * emissionArr[i + 1];
					chordEm[2] -= partAlpha[2] * emissionArr[i + 2];
					crossingParticles--;
				}
			}
			if(z2 > z) {
				let localEm = [0.0, 0.0, 0.0/* , 0.0 */];
				//let localAlpha = [0.0, 0.0, 0.0/* , 0.0 */];
				let localAlpha = chordAlpha;
				if(crossingParticles == 0) {
					//Empty -> fog
					//localEm = [0.0, 0.0, 0.0/* , 0.0 */];
					localAlpha = [0.0625, 0.0625, 0.0625/* , 0.0 */];
				} else {
					//localAlpha = chordAlpha;
					localEm[0] = chordEm[0] / localAlpha[0];
					localEm[1] = chordEm[1] / localAlpha[1];
					localEm[2] = chordEm[2] / localAlpha[2];
				}

				//Render ray segment into fragment (order-sensitive alpha blend)
				const factor = this.constants.opacityFactor * (z2 - z);
				/* const segAlpha0 = Math.exp(factor * localAlpha[0]);
				const segAlpha1 = Math.exp(factor * localAlpha[1]);
				const segAlpha2 = Math.exp(factor * localAlpha[2]); */
				const segAlpha = [Math.exp(factor * localAlpha[0]),
					Math.exp(factor * localAlpha[1]),
					Math.exp(factor * localAlpha[2])];
				em[0] += alpha[0] * localEm[0] * (1.0 - segAlpha[0]);
				em[1] += alpha[1] * localEm[1] * (1.0 - segAlpha[1]);
				em[2] += alpha[2] * localEm[2] * (1.0 - segAlpha[2]);
				alpha[0] *= segAlpha[0];
				alpha[1] *= segAlpha[1];
				alpha[2] *= segAlpha[2];
				if(alpha[0] < this.constants.rayTranspThreshold && alpha[1] < this.constants.rayTranspThreshold && alpha[2] < this.constants.rayTranspThreshold) break;
			}
			z = z2;
		}
		//return em;
		//return [0.0, 0.5, 1.0, 0.0];
		this.color(em[0], em[1], em[2]);
	}, {
		//argumentTypes: {accumBufferEmission: "Array(4)", accumBufferTransp: "Array(4)"},
		//argumentTypes: {accumBufferEmission: "TextureArray(4)", accumBufferTransp: "TextureArray(4)"},
		constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold},
		output: [cw, ch],
		//optimizeFloatMemory: true,
		//immutable: true,
		//pipeline: true,
		//dynamicOutput: true,
		dynamicArguments: true,
		graphical: true
		//to do: precision
	});

	newKernels.drawPixels = gpu.createKernel(function(buf, cw, ch) {
		/* let arr = [[0.0, 0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0, 0.0]]; */
		const pPixel = 4 * (this.thread.y * cw + this.thread.x);
		this.color(buf[pPixel], buf[pPixel + 1], buf[pPixel + 2]);
	}, {
		argumentTypes: {buf: "Array", cw: "Integer", ch: "Integer"},
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
		rayDirsCol[4 * x    ] = 0.0;
		rayDirsCol[4 * x + 1] = xf;
		rayDirsCol[4 * x + 2] = 1.0;
		rayDirsCol[4 * x + 3] = 1.0 + xf * xf; //Partial sum of squares
		
		//lenInv = 1.0 /* / Math.sqrt(1.0 + xf * xf) */;
		rowNormals[4 * x    ] = 0.0;
		rowNormals[4 * x + 1] = -1.0 /* * lenInv */;
		rowNormals[4 * x + 2] = xf /* * lenInv */;
	}
	
	rayDirsRow = new Float32Array(cw * 4);
	colNormals = new Float32Array(cw * 4);
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		rayDirsRow[4 * x    ] = xf;
		rayDirsRow[4 * x + 1] = 0.0;
		rayDirsRow[4 * x + 2] = 0.0;
		rayDirsRow[4 * x + 3] = xf * xf; //Partial sum of squares
		
		//lenInv = 1.0 /* / Math.sqrt(1.0 + xf * xf) */;
		colNormals[4 * x    ] = -1.0 /* * lenInv */;
		colNormals[4 * x + 1] = 0.0;
		colNormals[4 * x + 2] = xf /* * lenInv */;
	}

	//texRayDirs = generalKernels.rayDirs2d(rayDirsCol, rayDirsRow);
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
	
	const particlesZSorted = [];
	//particlesZSorted.length = 0; //Clear array
	if(!partPosLocal) partPosLocal = new Float32Array(4 * particles.count);
	for(let i = 0; i < particles.count; i++) {
		//const pos = particles.pos.subarray(4 * i, 4 * i + 3);
		const pos = [particles.pos[4 * i] - clientPos[0], particles.pos[4 * i + 1] - clientPos[1], particles.pos[4 * i + 2] - clientPos[2]];
		const posAligned = vectorTransform_3(clientSpcTransfInv, pos);
		partPosLocal.set(posAligned, 4 * i);
		//const dist = Math.hypot(posAligned[0], posAligned[1], posAligned[2]);
		const dist = posAligned[2];
		if(dist > -particles.r[i]) //Particles in front of viewer, perhaps partially
			particlesZSorted.push({i: i, z: dist});
	}
	particlesZSorted.sort((a, b) => (a.z - b.z));

	//to do: use gpu.input
	//const imgData = new ImageData(cw, ch);
	//const imgArr = imgData.data;
	//const imgArr = new Float32Array(4 * cw * ch);
	//const frameRows = [];
	const stopCount = new Int32Array(cw * ch);
	const indexes = [], depths = [], extremes = [];
	let maxStopCount = 0;
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
		//console.debug(`frameRenderRaycasting, row ${y}: ${particlesInRow.length} particles`);

		//const particlesInRays = [];
		//const rowStopCount = [];
		//const rowStopCount = new Float32Array(cw);
		//const rowIndexes = [], rowDepths = [], rowExtremes = [];
		//let maxStopCount = 0;
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
					//const rayDirFactor = 1.0 / Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
					const rayDirFactor = 1.0 / Math.sqrt(rayDirsRow[4 * x + 3] + rayDirsCol[4 * y + 3]);
					const z = rayDirFactor * (rayDir[0] * pos[0] + rayDir[1] * pos[1] + rayDir[2] * pos[2]);
					particlesInRay.push({i: p, z: z - rem2, st: true}); //st = start of sphere
					particlesInRay.push({i: p, z: z + rem2, st: false});
				}
			}
			particlesInRay.sort((a, b) => (a.z - b.z));
			/* const rayIndexes = [], rayDepths = [], rayExtremes = [];
			for(const part of particlesInRay) { //to do: try map()
				rayIndexes.push(part.i);
				rayDepths.push(part.z);
				rayExtremes.push(part.st);
			} */
			const rayIndexes = particlesInRay.map(p => p.i), rayDepths = particlesInRay.map(p => p.z), rayExtremes = particlesInRay.map(p => p.st);
			/* rayIndexes.length = 32;
			rayDepths.length = 32;
			rayExtremes.length = 32; */
			/* const rayIndexes = new Uint32Array(2 * particlesInRow.length), rayDepths = new Float32Array(2 * particlesInRow.length), rayExtremes = new Uint32Array(2 * particlesInRow.length);
			for(const i in particlesInRay) {
				rayIndexes[i] = particlesInRay[i].i;
				rayDepths[i] = particlesInRay[i].z;
				rayExtremes[i] = particlesInRay[i].st;
			} */
			maxStopCount = Math.max(maxStopCount, particlesInRay.length);
			//rowStopCount.push(particlesInRay.length);
			//stopCount[x] = particlesInRay.length;
			stopCount[y * cw + x] = particlesInRay.length;
			indexes.push(rayIndexes);
			depths.push(rayDepths);
			extremes.push(rayExtremes);
			
			/* //Render particles by segment sections as they cross the ray
			let em0 = 0.0, em1 = 0.0, em2 = 0.0;
			let alpha0 = 1.0, alpha1 = 1.0, alpha2 = 1.0;

			const localParticleSet = new Set();
			let j = 0, z = 0.0, z2 = 0.0; */
			/* while(j < particlesInRay.length) {
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
						for(const i of localParticleSet) {
							const pPart = 4 * i;
							const segAlpha0 = particles.alpha[pPart    ];
							const segAlpha1 = particles.alpha[pPart + 1];
							const segAlpha2 = particles.alpha[pPart + 2];
							localEm0 += particles.emission[pPart    ] * segAlpha0;
							localEm1 += particles.emission[pPart + 1] * segAlpha1;
							localEm2 += particles.emission[pPart + 2] * segAlpha2;
							localAlpha0 += segAlpha0;
							localAlpha1 += segAlpha1;
							localAlpha2 += segAlpha2;
						}
						localEm0 /= localAlpha0;
						localEm1 /= localAlpha1;
						localEm2 /= localAlpha2;
					} else {
						//Fog
						localAlpha0 = 0.0625;
						localAlpha1 = 0.0625;
						localAlpha2 = 0.0625;
						localEm0 = 0.0;
						localEm1 = 0.0;
						localEm2 = 0.0;
					}
					//Render ray segment into fragment (order-sensitive alpha blend)
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
					if(alpha0 < rayTranspThreshold && alpha1 < rayTranspThreshold && alpha2 < rayTranspThreshold) break;
				}
				z = z2;
			} */

			//particlesInRays.push(particlesInRay);
			/* if(alpha0 === 1.0) em0 = 0.0; else em0 /= (1.0 - alpha0);
			if(alpha1 === 1.0) em1 = 0.0; else em1 /= (1.0 - alpha1);
			if(alpha2 === 1.0) em2 = 0.0; else em2 /= (1.0 - alpha2); */
			/* if(alpha0 !== 1.0) em0 /= (1.0 - alpha0);
			if(alpha1 !== 1.0) em1 /= (1.0 - alpha1);
			if(alpha2 !== 1.0) em2 /= (1.0 - alpha2); */
			/* em0 += 0.0 * alpha0;
			em1 += 0.0 * alpha1;
			em2 += 0.0 * alpha2; */
			/* const pPixel = 4 * (y * cw + x);
			imgArr[pPixel    ] = em0;
			imgArr[pPixel + 1] = em1;
			imgArr[pPixel + 2] = em2; */
			/* imgArr[pPixel    ] = alpha0;
			imgArr[pPixel + 1] = alpha1;
			imgArr[pPixel + 2] = alpha2; */
		}
		//texParticles = gpu.input(particlesZSortedArr, [particlesZSortedArr.length]); //to do: check case
		
		/* maxStopCount = 16;
		const rowIndexesArr = new Float32Array(cw * maxStopCount), rowDepthsArr = new Float32Array(cw * maxStopCount), rowExtremesArr = new Float32Array(cw * maxStopCount);
		for(let x = 0; x < cw; x++) {
			for(let i = 0; i < maxStopCount; i++) {
				rowIndexesArr[x * maxStopCount + i] = rowIndexes[x][i] || 0;
				rowDepthsArr[x * maxStopCount + i] = rowDepths[x][i] || 0;
				rowExtremesArr[x * maxStopCount + i] = rowExtremes[x][i] || 0; */
				/* rowIndexesArr[i * cw + x] = rowIndexes[x][i] || 0;
				rowDepthsArr[i * cw + x] = rowDepths[x][i] || 0;
				rowExtremesArr[i * cw + x] = rowExtremes[x][i] || 0; */
			/* }
		} */

		//frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission, rowStopCount, rowIndexes, rowDepths, rowExtremes));
		//frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission, rowStopCount, rowIndexesArr, rowDepthsArr, rowExtremesArr, maxStopCount));
		/* frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission,
			rowStopCount,
			GPUClass.input(rowIndexesArr, [maxStopCount, cw]),
			GPUClass.input(rowDepthsArr, [maxStopCount, cw]),
			GPUClass.input(rowExtremesArr, [maxStopCount, cw]), maxStopCount)); */
		/* frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission,
			rowStopCount,
			GPUClass.input(rowIndexesArr, [cw, maxStopCount]),
			GPUClass.input(rowDepthsArr, [cw, maxStopCount]),
			GPUClass.input(rowExtremesArr, [cw, maxStopCount]), maxStopCount)); */
	}
	//generalKernels.drawPixels(imgArr, cw, ch);
	//generalKernels.drawPixels(frameRows, cw, ch);

	console.debug(`frameRenderRaycasting, maxStopCount: ${maxStopCount}`);
	//maxStopCount = 4;
	maxStopCount = Math.max(4, maxStopCount);
	const indexesArr = new Int32Array(cw * ch * maxStopCount), depthsArr = new Float32Array(cw * ch * maxStopCount), extremesArr = new Int32Array(cw * ch * maxStopCount);
	for(let x = 0; x < cw * ch; x++) {
		indexesArr.set(indexes[x], x * maxStopCount);
		depthsArr.set(depths[x], x * maxStopCount);
		extremesArr.set(extremes[x], x * maxStopCount);
	}
	generalKernels.rayCastRow(particles.alpha, particles.emission, stopCount, indexesArr, depthsArr, extremesArr, maxStopCount, cw);
}
