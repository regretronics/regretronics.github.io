"use strict";

//to do: multithreaded rendering?

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

function genNoiseLayerArray(layer, bufW, bufH, x0, y0) {
	const matrix1 = new Float32Array(bufW * bufH);

	//for(let i = 0; i < fragCount; i++) {
	for(let pFrag = 0, y = 0; y < bufH; y++) {
		/* const py = Math.round(sy * y + y0),
			ySgn = 2 * Number(py >= 0),
			yAbs = Math.abs(py),
			serialPart = 4 * yAbs + ySgn; */
		const py = Math.round(y + y0),
			ySgn = 2 * Number(py >= 0),
			yAbs = Math.abs(py),
			pAbsSum0 = layer + yAbs,
			serialPart = 4 * layer + 2 * pAbsSum0 * (pAbsSum0 - 1) + ySgn; //to do: recheck

		for(let x = 0; x < bufW; x++) {
			const px = Math.round(x + x0),
				xAbs = Math.abs(px);

			const pAbsSum = xAbs + pAbsSum0,
				serial = serialPart + 2 * pAbsSum * (pAbsSum - 1) + Number(px >= 0);
			const exp = 0.5 * (Math.sqrt(5) + 1), ratio = Math.PI - 1, bias = Math.E;
			matrix1[pFrag++] = (serial ** exp + ratio * serial + bias) % 1 - 0.5;
		}
	}

	//Blur and subtraction (high-pass)
	const matrix2 = new Float32Array(bufW * bufH);
	for(let y = 1; y < bufH - 1; y++) {
		let pFrag = bufW * y;
		for(let x = 1; x < bufW - 1; x++) {
			//matrix2[pFrag + x] = matrix1[pFrag + x];
			matrix2[pFrag + x] = 
				-0.0625 * matrix1[pFrag - bufW + x - 1] + -0.125 * matrix1[pFrag - bufW + x] + -0.0625 * matrix1[pFrag - bufW + x + 1] +
				-0.125 * matrix1[pFrag + x - 1] + 0.75 * matrix1[pFrag + x] + -0.125 * matrix1[pFrag + x + 1] +
				-0.0625 * matrix1[pFrag + bufW + x - 1] + -0.125 * matrix1[pFrag + bufW + x] + -0.0625 * matrix1[pFrag + bufW + x + 1];
		}
	}

	return matrix2;
}

const //Cubic Bezier piecewise functions
	b3Piece00 = x => ((1 + 2 * x) * (x - 1) * (x - 1)),
	b3Piece01 = x => (x * x * (3 - 2 * x)),
	b3Piece10 = x => (x * (x - 1) * (x - 1)),
	b3Piece11 = x => (x * x * (x - 1));
//const filterPieces = [x => (0), x => (1 - x), x => (x), x => (0)];
/* const filterPieces = [
	x => (0.5 * b3Piece11(x)),
	x => (0.5 * b3Piece10(x) + b3Piece01(x)),
	x => (b3Piece00(x) - 0.5 * b3Piece11(x)),
	x => (-0.5 * b3Piece10(x))]; */
const filterPieces = [b3Piece00, b3Piece01, b3Piece10, b3Piece11];

function frameRenderNoise1(imgData) {
	const data = imgData.data/* , l = data.length */;
	const bufH = imgData.height, bufW = imgData.width;

	//const matW = bufW + 2, matH = bufH + 2;
	const x0 = cx - 0.5 * scale * bufW, x0i = Math.floor(x0), x0f = x0 - x0i;
	const y0 = cy - 0.5 * scale * bufH, y0i = Math.floor(y0), y0f = y0 - y0i;
	const matW = Math.ceil(bufW * scale) + 6, matH = Math.ceil(bufH * scale) + 6;
	const layer = genNoiseLayerArray(0, matW, matH, x0i - 3, y0i - 3);
	//const layer = genNoiseLayerArray(0, matW, matH, cx - 0.5 * bufW * scale, cy - 0.5 * bufH * scale);
	
	//note: the alpha channel must be also set for the result to be visible.
	//simplifying the loop condition is also a loop optimization.
	/* for(let i = 0; i < l; i += 4) {
		//const ip = Math.floor(i / 4), y = Math.floor(ip / bufW), x = ip - bufW * y;

		const v = Math.round(255 * (layer[i / 4] + 0.5));
		data[i] = v;
		data[i + 1] = v;
		data[i + 2] = v;
	} */

	//Linear interpolation
	/* for(let pFrag = 0, y = 0; y < bufH; y++) {
		const sy = scale * y, syi = Math.floor(sy), syf = sy % 1, sy1f = 1 - syf;
		for(let x = 0; x < bufW; x++) {
			const sx = scale * x, sxi = Math.floor(sx), sxf = sx % 1;
			const
				v00 = layer[(syi) * matW + sxi],
				v01 = layer[(syi) * matW + sxi + 1],
				v10 = layer[(syi + 1) * matW + sxi],
				v11 = layer[(syi + 1) * matW + sxi + 1];
			const v =
				v00 * sy1f * (1 - sxf) +
				v01 * sy1f * sxf +
				v10 * syf * (1 - sxf) +
				v11 * syf * sxf;
			const vi = Math.round(255 * (v + 0.5));

			data[pFrag] = vi;
			data[pFrag + 1] = vi;
			data[pFrag + 2] = vi;
			pFrag += 4;
		}
	} */

	const sourceFrags = new Float32Array(16);
	for(let pFrag = 0, y = 0, syiOld = -1, sxiOld = -1; y < bufH; y++) {
		const sy = scale * (y + 0.5) + 1 + y0f + 0.5, syi = Math.floor(sy), syf = sy % 1;
		const filterCacheY = [filterPieces[0](syf), filterPieces[1](syf), filterPieces[2](syf), filterPieces[3](syf)];
		for(let x = 0; x < bufW; x++) {
			const sx = scale * (x + 0.5) + 1 + x0f + 0.5, sxi = Math.floor(sx), sxf = sx % 1;
			const filterCacheX = [filterPieces[0](sxf), filterPieces[1](sxf), filterPieces[2](sxf), filterPieces[3](sxf)];
			
			if((syi != syiOld) || (sxi != sxiOld))
				for(let y2 = 0; y2 < 4; y2++) {
					for(let x2 = 0; x2 < 4; x2++)
						sourceFrags[y2 * 4 + x2] = layer[(syi + y2) * matW + sxi + x2];
				}
			syiOld = syi;
			sxiOld = sxi;

			let v = 0;
			for(let y2 = 0; y2 < 4; y2++) {
				for(let x2 = 0; x2 < 4; x2++)
					//v += sourceFrags[y2 * 4 + x2] * filterPieces[y2](syf) * filterPieces[x2](sxf);
					v += sourceFrags[y2 * 4 + x2] * filterCacheY[y2] * filterCacheX[x2];
			}

			const vi = Math.round(255 * (v + 0.5));
			data[pFrag] = vi;
			data[pFrag + 1] = vi;
			data[pFrag + 2] = vi;
			pFrag += 4;
		}
	}
}
function frameRenderNoise2(imgData, cx, cy, scale) {
	const data = imgData.data;
	const bufH = imgData.height, bufW = imgData.width;
	const accumBuf = new Float32Array(bufW * bufH);

	const scaleLog = - Math.log2(scale), scaleLogi = Math.ceil(scaleLog);
	for(let layerI = 0; layerI < scaleLogi; layerI++) {
	//for(let layerI = 0; layerI < 1; layerI++) {
		const layerScale = 2 ** layerI, scale2 = scale * layerScale;
		const layerWeight = Math.min(1, scaleLog - layerI);

		const x0 = cx * layerScale - 0.5 * bufW * scale2 - 3, x0i = Math.floor(x0), x0f = x0 - x0i;
		const y0 = cy * layerScale - 0.5 * bufH * scale2 - 3, y0i = Math.floor(y0), y0f = y0 - y0i;
		const matW = Math.ceil(bufW * scale2) + 6, matH = Math.ceil(bufH * scale2) + 6;
		const layer = genNoiseLayerArray(layerI, matW, matH, x0i, y0i);
		
		const sourceFrags = new Float32Array(16);
		for(let pFrag = 0, y = 0, syiOld = -1, sxiOld = -1; y < bufH; y++) {
			const sy = scale2 * y + y0f + 1 + 0.5, syi = Math.floor(sy), syf = sy - syi;
			const filterCacheY = [filterPieces[0](syf), filterPieces[1](syf), filterPieces[2](syf), filterPieces[3](syf)];
			for(let x = 0; x < bufW; x++) {
				const sx = scale2 * x + x0f + 1 + 0.5, sxi = Math.floor(sx), sxf = sx - sxi;
				const filterCacheX = [filterPieces[0](sxf), filterPieces[1](sxf), filterPieces[2](sxf), filterPieces[3](sxf)];
				
				if((syi != syiOld) || (sxi != sxiOld))
					for(let y2 = 0; y2 < 4; y2++) {
						for(let x2 = 0; x2 < 4; x2++)
							sourceFrags[y2 * 4 + x2] = layer[(syi + y2) * matW + sxi + x2];
					}
				syiOld = syi;
				sxiOld = sxi;
	
				let v = 0;
				for(let y2 = 0; y2 < 4; y2++) {
					for(let x2 = 0; x2 < 4; x2++)
						v += sourceFrags[y2 * 4 + x2] * filterCacheY[y2] * filterCacheX[x2];
				}
				accumBuf[pFrag++] += layerWeight * v; //self-similar texture
				//accumBuf[pFrag++] += 2 * layerWeight * v / Math.sqrt(layerScale); //smaller scales are watered down
				//accumBuf[pFrag++] += 0.0625 * layerWeight * v / Math.sqrt(layerScale) / scale; //contrast is enhanced at small scales, curves getting more jagged
			}
		}	
	}

	for(let pFrag = 0; pFrag < bufW * bufH; pFrag++) {
		//const v = accumBuf[pFrag], vi = Math.round(255 * (v + 0.5));
		const v = accumBuf[pFrag], vi = Math.round(255 * (0.25 * v + 0.5));
		data[4 * pFrag] = vi;
		data[4 * pFrag + 1] = vi;
		data[4 * pFrag + 2] = vi;
		//pFrag += 4;
	}
}
