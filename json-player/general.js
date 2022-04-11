//to do: add note release time? (so that duration may affect nonspecified next noteStart, but release won't)
const defaultNoteNode = {
	noteStart: 0,
	duration: 1,
	freq: defaultBlockNode.freqRatio,
	vol: defaultBlockNode.volRatio,
	decayFactor: defaultBlockNode.decayFactor,
	attack: defaultBlockNode.attack
};

function nullToDefault(x, def) {
	return x === null ? def : x;
}
//recursive call
function parseNumber(n) {
	if(arguments.length < 1) return null;
	if(n === undefined) return null;
	let t = typeof(n);

	//simpler attempts first.
	if(t === "number") return n;

	//try conversion to number
	//JavaScript converts Number("") and Number([]) to 0. let's prevent this.
	if(!Array.isArray(n) && ((t !== "string") || (n.length != 0))) {
		let ret = Number(n);
		if(!isNaN(ret)) return ret;
	}

	//can be a fraction
	if(t === "string") {
		if(n.length == 0) return null;
		//to do: maybe support addition and subtraction?
		
		//multiplication: "3*4*5" -> 3*(4*5)
		//"*x" = "x*" = 1*x
		let f = n.indexOf("*");
		if(f >= 0) {
			return nullToDefault(parseNumber(n.slice(0, f)), 1)
				* nullToDefault(parseNumber(n.slice(f + 1)), 1);
		} else {
			//division: "3/4/5" -> (3/4)/5
			//"/x" = 1/x
			//"x/" = x/1
			f = n.lastIndexOf("/");
			if(f >= 0) {
				return nullToDefault(parseNumber(n.slice(0, f)), 1)
					/ nullToDefault(parseNumber(n.slice(f + 1)), 1);
			} else {
				//exponentiation: "x^y^z" = x^(y^z)
				//"x^" = x^1
				//"^x" = 2^x?
				f = n.indexOf("^");
				if(f >= 0) {
					return nullToDefault(parseNumber(n.slice(0, f)), 2)
						** nullToDefault(parseNumber(n.slice(f + 1)), 1);
				} else {
					//to do: maybe support parentheses
					//	for that, use regular expressions, like ((\(.*\))|.*)/([^/]*|\(.*\)) for division? probably inadequate, as they are not recursive.
					return null;
				}
			}
		}
	}

	//prime factor-based
	let r = 1, i;
	if(Array.isArray(n)) {
		for(i in n) {
			r *= Math.pow(primes[i], nullToDefault(parseNumber(n[i]), 1));
		}
		return r;
	}

	//objects with explicit factors
	for(i in n) {
		//1 as default base neutralizes unrecognized bases
		let iNum = nullToDefault(parseNumber(i), 1);
		if(isNaN(iNum)) continue;
		r *= Math.pow(iNum, nullToDefault(parseNumber(n[i]), 1));
	}
	return r;
}
