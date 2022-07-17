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

	//let bufh = imgData.height, bufw = imgData.width;
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
	let data = imgData.data, i;
	let bufh = imgData.height|0, bufw = imgData.width|0;

	//polar-based drawing
	i = 0;
	//let color = new Array(3);
	//Object.preventExtensions(color); //these two break the code.
	//Object.seal(color);
	//apparently, let is marginally faster than let
	//let requires ECMAScript 6/2015.
	//optimization: precompute things outside the loops.
	for(let y = 0, x, y2 = 0.5 - 0.5 * bufh, y2sqr, x20 = 0.5 - 0.5 * bufw, x2, r, theta, r2, theta2; y < bufh; y++, y2++) {
		//y2 = y + 0.5 - 0.5 * bufh;
		y2sqr = y2 * y2;
		x2 = x20;
		for(x = 0; x < bufw; x++, x2++) {
			//x2 = x + 0.5 - 0.5 * bufw;

			//optimization: scale only the radius, not y2 and x2
			/*let r = 2 / bufh * Math.sqrt(x2 * x2 + y2 * y2);
			let r2 = r - Math.floor(r);
			let r3 = (r == 0) ? 0 : (Math.log(r) / Math.LN2);
			//striping
			r3 = Math.floor(r3);
			r3 = r3 - 2 * Math.floor(0.5 * r3);

			let theta = Math.atan2(y2, x2) / (2 * Math.PI) + 0.5;
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
			//color = [(255 * r2)|0, (64 + 128 * ((r2 + theta2) % 2))|0, (255 * theta2)|0];
			/*color[0] = 128 * r2;
			color[1] = 255 * ((r2 + theta2) % 2);
			color[2] = 128 * theta2;*/
			/*data[i] = 64 + 128 * r2;
			data[i + 1] = 255 * ((r2 + theta2) % 2);
			data[i + 2] = 64 + 128 * theta2;*/
			
			//color write to pixel
			//i = 4 * (bufw * y + x);
			/*data[i] = color[0];
			data[i + 1] = color[1];
			data[i + 2] = color[2];*/
			data[i] = (255 * r2);
			data[i + 1] = (64 + 128 * ((r2 + theta2) % 2));
			data[i + 2] = (255 * theta2);
			//data[i + 3] = 255;
			i += 4;
		}
	}
}

//to do: other kinds of frameRender
//to do: multithreaded rendering
